import { RegistryProvider } from "@effect/atom-react"
import type { Harness } from "@ivin/contracts/session"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { serverStateAtom } from "../modules/server/atoms/server-state.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { builtinPlugins } from "./builtin-plugins.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import { SidebarTabs } from "./sidebar-tabs.tsx"

const setup = async (
  titles: ReadonlyArray<string>,
  options: { holdTabs?: boolean; harness?: Harness } = {},
) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  titles.forEach((title, index) => {
    server.sessions.set(`s${index + 1}`, {
      id: `s${index + 1}`,
      projectPath: "/p",
      workingFolder: "/p",
      inWorktree: false,
      branch: "main",
      started: true,
      workingFolderDeleted: false,
      title,
      harness: options.harness ?? "claude",
      model: "sonnet",
      effort: "high",
      permissionMode: "manual",
      relaunchFailure: null,
      pendingMessages: [],
      unreadMessages: [],
      backgroundTasks: [],
      status: "idle",
      statusChangedAt: at,
      createdAt: at,
      lastActivityAt: at,
      archivedAt: null,
      lastImageNumber: 0,
      waitingFor: null,
    })
    if (title !== "Closed") server.openTab(`s${index + 1}`)
  })
  const list = options.holdTabs ? server.holdNextTabList() : null
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return Object.assign(server, { list })
}

test("a project with no open tab leaves its sentence to the main area", async () => {
  await setup(["Closed"])
  await expect.element(page.getByText(/Inactive sessions/)).toBeVisible()
  expect(page.getByText(/No session/).query()).toBeNull()
})

test("each row shows the session status and follows the server", async () => {
  const server = await setup(["One"])
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Idle")

  server.setStatus("s1", "working")
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Working")
  server.setStatus("s1", "failed")
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Failed")
})

test("a session waiting on the user stays in tab order, outlined, with no group of its own", async () => {
  const server = await setup(["One", "Two"])

  server.setStatus("s1", "waiting")
  const rows = page.getByRole("region", { name: "Sessions" }).getByTestId("session-item")
  await expect
    .element(rows.first().getByTestId("session-status"))
    .toHaveTextContent("Waiting for you")
  await expect.element(rows.first()).toHaveAttribute("data-attention")
  await expect.element(rows).toHaveLength(2)
  expect(page.getByRole("region", { name: "Needs you" }).query()).toBeNull()
})

test("only sessions with an open tab are listed, and picking one selects its tab", async () => {
  const server = await setup(["One", "Closed", "Two"])
  await expect.element(page.getByTestId("session-item")).toHaveLength(2)

  await page.getByTestId("session-item").first().getByRole("button").first().click()
  await vi.waitFor(() => expect(server.tabOrder("/p")).toEqual(["s1", "s3"]))
  await expect
    .element(page.getByTestId("session-item").first().getByRole("button").first())
    .toHaveAttribute("aria-current", "true")
})

test("each row shows its branch, and whether it runs in the checkout or a worktree", async () => {
  const server = await setup(["One", "Two"])
  const two = server.sessions.get("s2")!
  server.sessions.set("s2", {
    ...two,
    workingFolder: "/p/.worktrees/feat-login",
    inWorktree: true,
    branch: "feat/login",
  })
  server.setStatus("s2", "idle")

  const rows = page.getByTestId("session-location")
  await expect.element(rows.nth(1)).toHaveTextContent("Worktreefeat/login")
  await expect.element(rows.nth(0)).toHaveTextContent("Current checkoutmain")
})

test("a session outside a git repository has no branch line", async () => {
  const server = await setup(["One"])
  server.sessions.set("s1", { ...server.sessions.get("s1")!, branch: null })
  server.setStatus("s1", "working")
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Working")
  expect(page.getByTestId("session-location").query()).toBeNull()
})

test("a row draws its session's harness mark", async () => {
  await setup(["One"], { harness: "codex" })
  const row = page.getByTestId("session-item").element()
  expect(row.querySelector(".iv-harness-mark--agent")).not.toBeNull()
  expect(row.querySelector(".iv-harness-mark--claude")).toBeNull()
})

test("a claude session's row draws the Claude mark", async () => {
  await setup(["One"])
  await expect.element(page.getByTestId("session-item")).toBeVisible()
  expect(
    page.getByTestId("session-item").element().querySelector(".iv-harness-mark--claude"),
  ).not.toBeNull()
})

test("a branch name too long for the row keeps its gap after the worktree icon", async () => {
  const branchName = "ci/176-repeat-the-tests-a-pull-request-adds-twenty-times-before-it-merges"
  const server = await setup(["One"])
  server.sessions.set("s1", {
    ...server.sessions.get("s1")!,
    workingFolder: "/p/.worktrees/ci-long",
    inWorktree: true,
    branch: branchName,
  })
  server.setStatus("s1", "idle")
  await expect
    .element(page.getByTestId("session-location"))
    .toHaveTextContent(`Worktree${branchName}`)

  const location = page.getByTestId("session-location").element() as HTMLElement
  location.parentElement!.style.width = "160px"
  const icon = location.querySelector("svg")!.getBoundingClientRect()
  const branchItem = location.querySelector<HTMLElement>(".iv-session-location__branch")!
  const branchLabel = branchItem.querySelector<HTMLElement>(".iv-session-location__name")!
  expect(branchLabel.scrollWidth).toBeGreaterThan(branchLabel.clientWidth)
  const branch = branchItem.getBoundingClientRect()
  expect(branch.left - icon.right).toBeGreaterThanOrEqual(4)
})

test("a tab list that cannot load says so with Retry, and Retry clears it", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.failCalls("tab.list")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
      </PluginsProvider>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("The sessions could not be loaded.")).toBeVisible()

  server.recoverCalls("tab.list")
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("The sessions could not be loaded.")).not.toBeInTheDocument()
})

test("no error shows in the list while the server restarts, since the window already says so", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.failCalls("tab.list")
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [serverStateAtom, { kind: "restarting" }],
      ]}
    >
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
      </PluginsProvider>
    </RegistryProvider>,
  )

  await vi.waitFor(() => expect(server.callsOf("tab.list")).toBeGreaterThan(0))
  await expect.element(page.getByRole("region", { name: "Sessions" })).toBeVisible()
  expect(page.getByRole("alert").query()).toBeNull()
})

test("Retry on a session feed that failed clears the error once the feed runs again", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "First" }))
  server.openTab("s1")
  server.failCalls("session.watch")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("The sessions could not be loaded.")).toBeVisible()

  server.recoverCalls("session.watch")
  await page.getByRole("button", { name: "Retry" }).click()

  await expect.element(page.getByText("First", { exact: true })).toBeVisible()
  expect(page.getByRole("alert").query()).toBeNull()
})
