import { RegistryProvider } from "@effect/atom-react"
import type { Harness, SessionStatus } from "@ivin/contracts/session"
import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TabBar } from "./tab-bar.tsx"

const setup = async (
  status: SessionStatus,
  options: { stopAgentOnClose?: boolean; harness?: Harness } = {},
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
    status,
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <TabBar projectPath="/p" />
    </RegistryProvider>,
  )
  await expect.element(page.getByTestId("tab")).toBeVisible()
  return server
}

const closeTab = async () => {
  await page.getByTestId("tab").hover()
  await page.getByRole("button", { name: "Close Fix the login" }).click()
}
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
