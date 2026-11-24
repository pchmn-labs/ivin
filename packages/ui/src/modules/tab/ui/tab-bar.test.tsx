import { RegistryProvider } from "@effect/atom-react"
import type { Harness, SessionStatus } from "@ivin/contracts/session"
import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import type { ReactNode } from "react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { isMac } from "../../keybinding/adapters/platform.ts"
import { useKeyboardHandler } from "../../keybinding/hooks/use-keyboard-handler.ts"
import { TabBar } from "./tab-bar.tsx"

function WithKeys({ children }: { children: ReactNode }) {
  useKeyboardHandler()
  return children
}

const setup = async (
  status: SessionStatus,
  options: { stopAgentOnClose?: boolean; harness?: Harness; others?: ReadonlyArray<string> } = {},
) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  if (options.stopAgentOnClose === false) {
    server.setUserSettings({
      settings: { ...defaultSettings, tabs: { stopAgentOnClose: false } },
      problem: null,
    })
  }
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "Fix the login",
    harness: options.harness ?? "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    backgroundTasks: [],
    status,
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })
  for (const title of options.others ?? []) {
    server.sessions.set(title, makeTestSession({ id: title, projectPath: "/p", title }))
    server.openTab(title)
  }
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <WithKeys>
        <TabBar projectPath="/p" />
      </WithKeys>
    </RegistryProvider>,
  )
  await expect.element(page.getByTestId("tab").first()).toBeVisible()
  return server
}

const closeTab = async () => {
  await page.getByTestId("tab").hover()
  await page.getByTestId("tab-close").click()
}
const mod = isMac() ? "Meta" : "Control"
const confirmation = () => page.getByRole("dialog", { name: "Close the tab and stop its agent?" })

test("closing the tab of a working agent asks first, and Cancel keeps the tab and the agent", async () => {
  const server = await setup("working")
  await closeTab()
  await expect.element(confirmation()).toBeVisible()

  await page.getByRole("button", { name: "Cancel" }).click()

  await expect.element(confirmation()).not.toBeInTheDocument()
  await expect.element(page.getByTestId("tab")).toBeVisible()
  expect(server.tabOrder("/p")).toEqual(["s1"])
  expect(server.sessions.get("s1")?.status).toBe("working")
})

test("confirming closes the tab and stops the agent", async () => {
  const server = await setup("waiting")
  await closeTab()
  await page.getByRole("button", { name: "Stop and close" }).click()

  await expect.element(page.getByTestId("tab")).not.toBeInTheDocument()
  expect(server.sessions.get("s1")?.status).toBe("idle")
})

test.each([
  ["an idle agent", "idle" as const, {}],
  ["a working agent when stopping is turned off", "working" as const, { stopAgentOnClose: false }],
])("closing the tab of %s asks nothing", async (_, status, options) => {
  const server = await setup(status, options)
  await closeTab()

  await expect.element(page.getByTestId("tab")).not.toBeInTheDocument()
  expect(confirmation().query()).toBeNull()
  expect(server.sessions.get("s1")?.status).toBe(status)
})

test("a tab draws its session's harness mark", async () => {
  await setup("idle", { harness: "codex" })
  const tab = page.getByTestId("tab").element()
  expect(tab.querySelector(".iv-harness-mark--agent")).not.toBeNull()
  expect(tab.querySelector(".iv-harness-mark--claude")).toBeNull()
})

test("the tab of a session in background draws the pulsing dot and asks before it stops the tasks", async () => {
  await setup("in_background")

  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-status")).toBe(
    "in_background",
  )
  await closeTab()
  await expect.element(confirmation()).toBeVisible()
})

test("Ctrl+Shift+PageUp and PageDown move the selected tab one place, and stop at either end", async () => {
  const server = await setup("idle", { others: ["a", "b"] })
  expect(server.tabOrder("/p")).toEqual(["a", "b", "s1"])

  await userEvent.keyboard("{Control>}{Shift>}{PageUp}{/Shift}{/Control}")
  await expect.poll(() => server.tabOrder("/p")).toEqual(["a", "s1", "b"])
  await userEvent.keyboard("{Control>}{Shift>}{PageUp}{PageUp}{/Shift}{/Control}")
  await expect.poll(() => server.tabOrder("/p")).toEqual(["s1", "a", "b"])
  await userEvent.keyboard("{Control>}{Shift>}{PageDown}{/Shift}{/Control}")
  await expect.poll(() => server.tabOrder("/p")).toEqual(["a", "s1", "b"])
})

test("mod+W closes the selected tab, and asks first when its agent works", async () => {
  await setup("working", { others: ["a"] })
  await userEvent.keyboard(`{${mod}>}w{/${mod}}`)
  await expect.element(confirmation()).toBeVisible()
  await page.getByRole("button", { name: "Stop and close" }).click()
  await expect.element(page.getByTestId("tab-title")).toHaveTextContent("a")

  await userEvent.keyboard(`{${mod}>}w{/${mod}}`)
  await expect.element(page.getByTestId("tab")).not.toBeInTheDocument()
})

test("the tab list holds only tabs: its close buttons are out of the Tab order and hidden from screen readers", async () => {
  await setup("idle", { others: ["a"] })
  const list = page.getByRole("tablist", { name: "Open sessions" }).element()
  for (const close of list.querySelectorAll("[data-testid=tab-close]")) {
    expect(close.getAttribute("tabindex")).toBe("-1")
    expect(close.closest("[aria-hidden=true]")).not.toBeNull()
  }
  expect(page.getByRole("button", { name: /^Close / }).query()).toBeNull()
})
