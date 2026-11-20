import { RegistryProvider } from "@effect/atom-react"
import type { Harness } from "@ivin/contracts/session"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionList } from "./session-list.tsx"

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
      status: "idle",
      statusChangedAt: at,
      createdAt: at,
      lastActivityAt: at,
      archivedAt: null,
      lastImageNumber: 0,
    })
    if (title !== "Closed") server.openTab(`s${index + 1}`)
  })
  const list = options.holdTabs ? server.holdNextTabList() : null
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <SessionList projectPath="/p" projectName="p" />
    </RegistryProvider>,
  )
  return Object.assign(server, { list })
}

test("a project with no tab says how to start a session", async () => {
  await setup([])
  await expect
    .element(page.getByText("No sessions in p yet. Start one with New session."))
    .toBeVisible()
})

test("a project whose sessions all have their tab closed says no session is open", async () => {
  await setup(["Closed"])
  await expect.element(page.getByText("No session open. Start one with New session.")).toBeVisible()
  expect(page.getByText(/No sessions in p/).query()).toBeNull()
})

test("no empty message shows before the tab list has loaded", async () => {
  const server = await setup([], { holdTabs: true })
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(page.getByText(/Start one with New session/).query()).toBeNull()
  server.list?.release()
  await expect.element(page.getByText(/No sessions in p yet/)).toBeVisible()
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
