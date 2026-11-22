import { RegistryProvider } from "@effect/atom-react"
import type { Change, DiffLine, FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"
const worktree = "/dev/shop/.worktrees/fix-cart"

const change = (path: string, status: Change["status"], added = 1, deleted = 0): Change => ({
  path,
  previousPath: null,
  status,
  added: status === "untracked" ? null : added,
  deleted: status === "untracked" ? null : deleted,
})

const line = (
  kind: DiffLine["kind"],
  text: string,
  oldLine: number | null,
  newLine: number | null,
) => ({ kind, text, oldLine, newLine, changed: null }) satisfies DiffLine

const makeServer = () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Checkout flow",
      projectPath: project,
      workingFolder: project,
    }),
  )
  server.sessions.set(
    "s2",
    makeTestSession({
      id: "s2",
      title: "Fix the cart",
      projectPath: project,
      workingFolder: worktree,
      inWorktree: true,
    }),
  )
  const files: ReadonlyArray<FolderEntry> = [{ name: "README.md", kind: "file", ignored: false }]
  server.folders.set(project, files)
  server.folders.set(worktree, files)
  server.changes.set(project, {
    kind: "listed",
    changes: [
      change("README.md", "modified", 2, 1),
      change("src/cart.ts", "added", 3),
      change("old.ts", "deleted", 0, 4),
    ],
  })
  server.changes.set(worktree, { kind: "listed", changes: [change("notes.md", "untracked")] })
  server.diffs.set(`${project}/README.md`, {
    kind: "text",
    status: "modified",
    added: 2,
    deleted: 1,
    hunks: [
      {
        header: "@@ -1,2 +1,3 @@",
        lines: [
          line("context", "# Shop", 1, 1),
          line("deleted", "Sells things.", 2, null),
          line("added", "Sells shoes.", null, 2),
          line("added", "Open daily.", null, 3),
        ],
      },
    ],
  })
  server.diffs.set(`${project}/old.ts`, {
    kind: "text",
    status: "deleted",
    added: 0,
    deleted: 1,
    hunks: [{ header: "@@ -1 +0,0 @@", lines: [line("deleted", "export {}", 1, null)] }],
  })
  server.files.set(`${project}/README.md`, {
    kind: "text",
    text: "# Shop\nSells shoes.\nOpen daily.\n",
  })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = async (server: FakeServer) => {
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 800 }}>
        <App />
      </div>
    </RegistryProvider>,
  )
  await userEvent.keyboard(`{${mod}>}3{/${mod}}`)
  return server
}

const changesTab = () =>
  page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: /^Changes/ })
const list = () => page.getByRole("list", { name: "Uncommitted changes" })
const row = (name: string) =>
  list().getByRole("button", {
    name: new RegExp(`^(modified|added|deleted|renamed|untracked) ${name}`),
  })
const card = () => page.getByRole("region", { name: "Open files" })
const cardTab = (name: string, options: { exact?: boolean } = {}) =>
  card()
    .getByRole("tablist", { name: "Open files" })
    .getByRole("tab", { name, ...options })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("the Changes tab lists the uncommitted changes with their status, and its label counts them", async () => {
  const server = await mount(makeServer())
  await expect.element(changesTab()).toHaveTextContent("Changes3")
  await expect.element(row("README.md")).toMatchTextContent(/\+2−1$/)
  await expect.element(row("cart.ts")).toMatchTextContent(/cart\.tssrc\+3$/)
  await expect.element(row("old.ts")).toMatchTextContent(/deleted/)

  server.changes.set(project, { kind: "listed", changes: [change("README.md", "modified")] })
  server.changeOnDisk(project, ["src/cart.ts", "old.ts"])
  await expect.element(row("cart.ts")).not.toBeInTheDocument()
  await expect.element(changesTab()).toHaveTextContent("Changes1")
})

test("the Changes tab follows the session on screen", async () => {
  await mount(makeServer())
  await expect.element(row("README.md")).toBeVisible()
  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect.element(row("notes.md")).toBeVisible()
  await expect.element(row("README.md")).not.toBeInTheDocument()
  await expect.element(changesTab()).toHaveTextContent("Changes1")
})

test("a click on a change opens its diff beside the chat, and Open file opens the file", async () => {
  await mount(makeServer())
  await row("README.md").click()
  await expect.element(cardTab("README.md diff")).toHaveAttribute("aria-selected", "true")
  await expect.element(row("README.md")).toHaveAttribute("aria-current", "true")
  const diff = page.getByTestId("diff-view")
  await expect.element(diff.getByText("Sells shoes.")).toBeVisible()
  await expect.element(diff.getByText("@@ -1,2 +1,3 @@")).toBeVisible()
  await expect.element(diff.getByText("Sells shoes.")).toHaveClass("iv-diff-line--added")
  await expect.element(diff.getByText("Sells things.")).toHaveClass("iv-diff-line--deleted")

  await card().getByRole("button", { name: "Open file" }).click()
  await expect
    .element(cardTab("README.md", { exact: true }))
    .toHaveAttribute("aria-selected", "true")
  await expect
    .element(page.getByRole("textbox", { name: "README.md" }))
    .toMatchTextContent(/Open daily\./)
  await expect.element(row("README.md")).not.toHaveAttribute("aria-current")
})

test("a change's Open file button opens the file, and a deleted file's diff has none", async () => {
  await mount(makeServer())
  await row("README.md").hover()
  await page.getByRole("button", { name: "Open README.md" }).click()
  await expect.element(page.getByRole("textbox", { name: "README.md" })).toBeVisible()

  await row("old.ts").click()
  await expect.element(page.getByTestId("diff-view").getByText("export {}")).toBeVisible()
  await expect.element(card().getByRole("button", { name: "Open file" })).not.toBeInTheDocument()
})

test("a diff with no change left, or a binary one, says so in its place", async () => {
  const server = await mount(makeServer())
  await row("cart.ts").click()
  await expect.element(card().getByText("cart.ts has no uncommitted changes.")).toBeVisible()

  server.diffs.set(`${project}/src/cart.ts`, { kind: "binary" })
  server.changeOnDisk(project, ["src/cart.ts"])
  await expect
    .element(card().getByText("cart.ts is a binary file, so its diff is not shown."))
    .toBeVisible()
})

test("when git fails the panel shows its message, and Retry lists the changes again", async () => {
  const server = makeServer()
  server.changes.set(project, { gitMessage: "fatal: index file corrupt" })
  await mount(server)
  await expect
    .element(page.getByRole("alert"))
    .toMatchTextContent(/^Git could not list the changes\. Fix what it reports, then retry\./)
  await expect.element(page.getByText("fatal: index file corrupt")).toBeVisible()

  server.changes.set(project, { kind: "listed", changes: [change("README.md", "modified")] })
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(row("README.md")).toBeVisible()
})

test("a working folder with no changes, or outside a git repository, says so", async () => {
  const server = makeServer()
  server.changes.set(project, { kind: "listed", changes: [] })
  server.changes.set(worktree, { kind: "not_repository" })
  await mount(server)
  await expect
    .element(page.getByText("No uncommitted changes. What the agent changes shows up here."))
    .toBeVisible()
  await expect.element(changesTab()).not.toMatchTextContent(/\d/)

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect
    .element(
      page.getByText(
        "This working folder is not in a git repository, so it has no changes to show.",
      ),
    )
    .toBeVisible()
})

test("an open diff is back at launch, from the server", async () => {
  const server = makeServer()
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews: [{ kind: "diff", path: "README.md" }],
    selected: { kind: "diff", path: "README.md" },
    fullWidth: false,
    sessionTabSelected: false,
  })
  await mount(server)
  await expect.element(cardTab("README.md diff")).toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByTestId("diff-view").getByText("Open daily.")).toBeVisible()
})
