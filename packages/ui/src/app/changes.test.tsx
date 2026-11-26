import type { Change, DiffLine, FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { storeSidebarTab } from "./stored-sidebar-tab.ts"
import { mountApp, seedSubViews } from "./test-app.tsx"

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
  server.committedChanges.set(project, {
    kind: "listed",
    base: "origin/main",
    changes: [
      change("README.md", "modified", 4, 2),
      change("docs/plan.md", "added", 8),
      change("src/old-cart.ts", "deleted", 0, 12),
    ],
  })
  server.committedDiffs.set(`${project}/docs/plan.md`, {
    kind: "text",
    status: "added",
    added: 1,
    deleted: 0,
    hunks: [{ header: "@@ -0,0 +1 @@", lines: [line("added", "# The plan", null, 1)] }],
  })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = async (server: FakeServer) => {
  storeSidebarTab("changes/panel")
  await mountApp(server, { height: 800 })
  return server
}

const openDiff = (server: FakeServer, path: string) =>
  seedSubViews(server, [{ view: "changes/diff", params: { kind: "working", path } }])

const discard = async (name: string) => {
  await row(name).hover()
  await page.getByRole("button", { name: `Discard the changes to ${name}` }).click()
}

const changesTab = () =>
  page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: /^Changes/ })
const list = () => page.getByRole("list", { name: "Uncommitted changes" })
const committedList = () => page.getByRole("list", { name: "Committed changes" })
const rowIn = (rows: ReturnType<typeof list>, name: string) =>
  rows.getByRole("button", {
    name: new RegExp(`^(modified|added|deleted|renamed|untracked) ${name}`),
  })
const row = (name: string) => rowIn(list(), name)
const committedRow = (name: string) => rowIn(committedList(), name)
const discardDialog = () => page.getByRole("dialog")
const heading = (name: string) => page.getByRole("button", { name: new RegExp(`^${name} \\d`) })
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
  const server = makeServer()
  server.committedChanges.delete(project)
  await mountApp(server, { height: 800 })
  await userEvent.keyboard(`{${mod}>}3{/${mod}}`)
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

test("the Changes tab follows the session into the worktree its agent moves to", async () => {
  const server = await mount(makeServer())
  await expect.element(row("README.md")).toBeVisible()

  server.moveSession("s1", worktree)
  await expect.element(row("notes.md")).toBeVisible()
  server.changes.set(worktree, { kind: "listed", changes: [change("cart.ts", "modified")] })
  server.changeOnDisk(worktree, ["cart.ts"])
  await expect.element(row("cart.ts")).toBeVisible()
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

  await card().getByRole("button", { name: "Open file" }).click()
  await expect
    .element(cardTab("README.md", { exact: true }))
    .toHaveAttribute("aria-selected", "true")
  await expect
    .element(page.getByRole("textbox", { name: "README.md" }))
    .toMatchTextContent(/Open daily\./)
  await expect.element(row("README.md")).not.toHaveAttribute("aria-current")
})

test("a deleted file's diff has no Open file button", async () => {
  const server = makeServer()
  openDiff(server, "old.ts")
  await mount(server)
  await expect.element(page.getByTestId("diff-view").getByText("export {}")).toBeVisible()
  await expect.element(card().getByRole("button", { name: "Open file" })).not.toBeInTheDocument()
})

test("a diff with no change left, or a binary one, says so in its place", async () => {
  const server = makeServer()
  openDiff(server, "src/cart.ts")
  await mount(server)
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

test("a branch with no change since its base, or a folder outside a git repository, says so in one sentence", async () => {
  const server = makeServer()
  server.changes.set(project, { kind: "listed", changes: [] })
  server.changes.set(worktree, { kind: "not_repository" })
  server.committedChanges.delete(project)
  await mount(server)
  await expect
    .element(page.getByText("No changes since origin/main. What the agent changes shows up here."))
    .toBeVisible()
  expect(page.getByText(/^No (un)?committed changes/).query()).toBeNull()
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
    subViews: [{ view: "changes/diff", params: { kind: "working", path: "README.md" } }],
    selected: { view: "changes/diff", params: { kind: "working", path: "README.md" } },
    fullWidth: false,
    sessionTabSelected: false,
  })
  await mount(server)
  await expect.element(cardTab("README.md diff")).toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByTestId("diff-view").getByText("Open daily.")).toBeVisible()
})

test("the Changes tab lists what the branch's commits changed under the uncommitted changes, and its label counts each changed file once", async () => {
  const server = await mount(makeServer())
  await expect.element(changesTab()).toHaveTextContent("Changes5")
  await expect.element(heading("Uncommitted")).toHaveTextContent("Uncommitted 3")
  await expect.element(heading("Committed")).toHaveTextContent("Committed 3")
  await expect
    .element(heading("Committed"))
    .toHaveAttribute("title", "Since the branch left origin/main")
  await expect.element(committedRow("plan.md")).toMatchTextContent(/plan\.mddocs\+8$/)
  await expect.element(committedRow("README.md")).toMatchTextContent(/\+4−2$/)
  await committedRow("plan.md").hover()
  await expect
    .element(committedList().getByRole("button", { name: /^Discard/ }))
    .not.toBeInTheDocument()

  server.changes.set(project, { kind: "listed", changes: [] })
  server.changeOnDisk(project, ["README.md"])
  await expect.element(changesTab()).toHaveTextContent("Changes3")
  await expect.element(page.getByText("No uncommitted changes.", { exact: false })).toBeVisible()
  await expect.element(committedRow("plan.md")).toBeVisible()
})

test("a click on a committed change opens what the commits changed, apart from its uncommitted diff", async () => {
  await mount(makeServer())
  await committedRow("plan.md").click()
  await expect.element(cardTab("plan.md committed")).toHaveAttribute("aria-selected", "true")
  await expect.element(committedRow("plan.md")).toHaveAttribute("aria-current", "true")
  await expect.element(page.getByTestId("diff-view").getByText("# The plan")).toBeVisible()

  await row("README.md").click()
  await expect.element(cardTab("README.md diff")).toHaveAttribute("aria-selected", "true")
  await expect.element(committedRow("README.md")).not.toHaveAttribute("aria-current")
  await committedRow("README.md").click()
  await expect.element(cardTab("README.md committed")).toHaveAttribute("aria-selected", "true")
  await expect
    .element(card().getByText("The branch's commits did not change README.md."))
    .toBeVisible()
})

test("the committed list says when the repository has no origin, or git does not know its default branch", async () => {
  const server = makeServer()
  server.committedChanges.set(project, { kind: "no_origin" })
  server.committedChanges.set(worktree, { kind: "no_default_branch" })
  await mount(server)
  await expect
    .element(
      page.getByText(
        "This repository has no origin remote, so the branch's commits cannot be listed.",
      ),
    )
    .toBeVisible()
  await expect.element(row("README.md")).toBeVisible()
  await expect.element(changesTab()).toHaveTextContent("Changes3")

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect
    .element(
      page.getByText(
        "Git does not know origin's default branch, so the branch's commits cannot be listed. Run git remote set-head origin --auto.",
      ),
    )
    .toBeVisible()
})

test("Backspace on a change asks first, naming the file, then restores it", async () => {
  await mount(makeServer())
  await expect.element(row("README.md")).toHaveAttribute("aria-keyshortcuts", "Backspace")
  ;(row("README.md").element() as HTMLElement).focus()
  await userEvent.keyboard("{Backspace}")
  await expect.element(discardDialog()).toHaveAccessibleName("Discard the changes to “README.md”?")
  await expect
    .element(discardDialog())
    .toHaveAccessibleDescription("The file goes back to its last commit. This cannot be undone.")
  await expect.element(discardDialog().getByText("README.md", { exact: true })).toBeVisible()
  await expect.element(discardDialog().getByRole("button", { name: "Cancel" })).toHaveFocus()
  await userEvent.keyboard("{Escape}")
  await expect.element(discardDialog()).not.toBeInTheDocument()
  await expect.element(row("README.md")).toBeVisible()

  ;(row("README.md").element() as HTMLElement).focus()
  await userEvent.keyboard("{Backspace}")
  await expect.element(discardDialog()).toBeVisible()
  await userEvent.keyboard("{Tab}")
  await expect
    .element(discardDialog().getByRole("button", { name: "Discard changes" }))
    .toHaveFocus()
  await userEvent.keyboard("{Enter}")
  await expect.element(discardDialog()).not.toBeInTheDocument()
  await expect.element(row("README.md")).not.toBeInTheDocument()
  await expect.element(changesTab()).toHaveTextContent("Changes5")
})

test("Discard all asks with what goes back and what is deleted, and discards only the changes it showed", async () => {
  const server = await mount(makeServer())
  await page.getByRole("button", { name: "Discard all uncommitted changes" }).click()
  await expect.element(discardDialog()).toHaveAccessibleName("Discard all uncommitted changes?")
  await expect
    .element(discardDialog())
    .toHaveAccessibleDescription(
      "2 files go back to their last commit, and 1 new file is deleted. This cannot be undone.",
    )
  const listed = server.changes.get(project)
  if (listed === undefined || !("changes" in listed)) throw new Error("no changes")
  server.changes.set(project, {
    kind: "listed",
    changes: [...listed.changes, change("late.ts", "untracked")],
  })
  server.changeOnDisk(project, ["late.ts"])
  await discardDialog().getByRole("button", { name: "Discard all" }).click()
  await expect.element(row("README.md")).not.toBeInTheDocument()
  await expect.element(row("late.ts")).toBeVisible()
  await expect.element(committedRow("plan.md")).toBeVisible()
})

test("Discard all with 40 changes keeps its buttons on screen and scrolls the list, and a long name wraps", async () => {
  const server = makeServer()
  const longName = `${"a".repeat(300)}.ts`
  server.changes.set(project, {
    kind: "listed",
    changes: [
      change(longName, "modified"),
      ...Array.from({ length: 39 }, (_, i) => change(`src/file-${i}.ts`, "modified")),
    ],
  })
  await mount(server)
  await page.getByRole("button", { name: "Discard all uncommitted changes" }).click()
  await expect.element(discardDialog()).toBeVisible()
  const box = discardDialog().element().getBoundingClientRect()
  expect(box.height).toBeLessThanOrEqual(window.innerHeight - 32)
  const discard = discardDialog().getByRole("button", { name: "Discard all" }).element()
  expect(discard.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
  const body = discardDialog().element().querySelector<HTMLElement>(".iv-dialog__body")!
  expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
})

test("⌘Backspace in the list asks to discard every uncommitted change", async () => {
  await mount(makeServer())
  ;(committedRow("plan.md").element() as HTMLElement).focus()
  await userEvent.keyboard("{Backspace}")
  await expect.element(discardDialog()).not.toBeInTheDocument()
  await userEvent.keyboard(`{${mod}>}{Backspace}{/${mod}}`)
  await expect.element(discardDialog()).toHaveAccessibleName("Discard all uncommitted changes?")
})

test("a failed Discard all shows git's message under the heading", async () => {
  const server = makeServer()
  server.discardFailures.set(`${project}/old.ts`, "fatal: Unable to create 'index.lock'")
  await mount(server)
  await page.getByRole("button", { name: "Discard all uncommitted changes" }).click()
  await discardDialog().getByRole("button", { name: "Discard all" }).click()
  await expect
    .element(page.getByRole("region", { name: "Uncommitted" }).getByRole("alert").first())
    .toMatchTextContent(
      /^Git could not discard the uncommitted changes\. Fix what it reports, then discard again\.\s*fatal: Unable to create 'index\.lock'$/,
    )
  await expect.element(row("README.md")).toBeVisible()
})

test("discarding an untracked file says it deletes it", async () => {
  await mount(makeServer())
  await sessionTab("Fix the cart").getByRole("tab").click()
  await discard("notes.md")
  await expect.element(discardDialog()).toHaveAccessibleName("Delete “notes.md”?")
  await expect
    .element(discardDialog())
    .toHaveAccessibleDescription(
      "Git does not track this file, so discarding its changes deletes it. This cannot be undone.",
    )
  await discardDialog().getByRole("button", { name: "Delete file" }).click()
  await expect
    .element(page.getByText("No changes since origin/main.", { exact: false }))
    .toBeVisible()
})

test("a failed discard shows git's message under the file's row", async () => {
  const server = makeServer()
  server.discardFailures.set(`${project}/README.md`, "fatal: Unable to create 'index.lock'")
  await mount(server)
  await discard("README.md")
  await discardDialog().getByRole("button", { name: "Discard changes" }).click()
  const failure = list().getByRole("listitem").filter({ hasText: "README.md" }).getByRole("alert")
  await expect
    .element(failure)
    .toMatchTextContent(
      /^Git could not discard the changes to README\.md\. Fix what it reports, then discard again\.\s*fatal: Unable to create 'index\.lock'$/,
    )
  await expect.element(row("README.md")).toBeVisible()

  server.discardFailures.clear()
  await discard("README.md")
  await discardDialog().getByRole("button", { name: "Discard changes" }).click()
  await expect.element(row("README.md")).not.toBeInTheDocument()
})

test("in a working folder of several repositories, a chip per repository with changes narrows both groups to it", async () => {
  const server = makeServer()
  server.changes.set(project, {
    kind: "listed",
    repositories: ["api", "web", "docs"],
    changes: [change("api/src/app.ts", "modified"), change("web/index.html", "added")],
  })
  server.committedChanges.set(project, {
    kind: "listed",
    base: "origin/main",
    changes: [change("api/src/db.ts", "modified"), change("web/api.ts", "added")],
  })
  await mount(server)
  await expect.element(changesTab()).toHaveTextContent("Changes4")
  await expect.element(page.getByRole("button", { name: "api 2" })).toBeVisible()
  await expect.element(page.getByRole("button", { name: "web 2" })).toBeVisible()
  await expect.element(page.getByRole("button", { name: /^docs/ })).not.toBeInTheDocument()
  await expect.element(row("app.ts")).toBeVisible()
  await expect.element(row("index.html")).toBeVisible()

  await page.getByRole("button", { name: "web 2" }).click()
  await expect.element(row("index.html")).toBeVisible()
  await expect.element(committedRow("api.ts")).toBeVisible()
  await expect.element(row("app.ts")).not.toBeInTheDocument()
  await expect.element(committedRow("db.ts")).not.toBeInTheDocument()

  await page.getByRole("button", { name: "All 4" }).click()
  await expect.element(row("app.ts")).toBeVisible()
  await expect.element(committedRow("db.ts")).toBeVisible()
})
