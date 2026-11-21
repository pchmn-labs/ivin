import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const project = "/dev/shop"
const worktree = "/dev/shop/.worktrees/fix-cart"

const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/") ? { name: name.slice(0, -1), kind: "folder" } : { name, kind: "file" },
  )

const makeServer = () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  for (const [id, title, workingFolder] of [
    ["s1", "Checkout flow", project],
    ["s2", "Fix the cart", worktree],
  ] as const) {
    server.sessions.set(id, {
      id,
      projectPath: project,
      workingFolder,
      inWorktree: workingFolder !== project,
      branch: "main",
      started: true,
      workingFolderDeleted: false,
      title,
      harness: "claude",
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
  }
  server.folders.set(project, folder("src/", "logo.png", "bundle.js", "gone.ts", "README.md"))
  server.folders.set(`${project}/src`, folder("main.ts"))
  server.folders.set(worktree, folder("notes.md"))
  server.files.set(`${project}/README.md`, { kind: "text", text: "# Shop\n" })
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: 'export const shop = "open"\n' })
  server.files.set(`${project}/logo.png`, { kind: "binary" })
  server.files.set(`${project}/bundle.js`, { kind: "too_large", size: 3 * 1024 * 1024 })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = (server: FakeServer) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <App />
    </RegistryProvider>,
  )

const showFiles = async () => {
  await page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: "Files" }).click()
}
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const card = () => page.getByRole("region", { name: "Open files" })
const fileTab = (name: string) =>
  card().getByRole("tablist", { name: "Open files" }).getByRole("tab", { name })
const code = (name: string) => page.getByRole("textbox", { name })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test("a file opened from the tree shows beside the chat, read only, in a tab of its own", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("README.md").click()

  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(code("README.md")).toHaveAttribute("aria-readonly", "true")
  expect(server.subViews.get("s1")?.subViews).toEqual([{ kind: "file", path: "README.md" }])
})

test("several files stay open; the last opened is selected, and a tab selects its file", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("src").click()
  await item("main.ts").click()

  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
  await expect.element(code("main.ts")).toHaveTextContent('export const shop = "open"')
  await fileTab("README.md").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "false")
})

test("the arrow keys move between the open files", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()
  await fileTab("logo.png").click()

  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("README.md")).toHaveFocus()
})

test("closing a file selects its neighbour, and closing the last one closes the card", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()

  await page.getByRole("button", { name: "Close logo.png" }).click()
  await expect.element(fileTab("logo.png")).not.toBeInTheDocument()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")

  await page.getByRole("button", { name: "Close README.md" }).click()
  await expect.element(card()).not.toBeInTheDocument()
  expect(server.subViews.get("s1")?.subViews).toEqual([])
})

test("a large file and a binary file say why they are not shown", async () => {
  await mount(makeServer())
  await showFiles()
  await item("bundle.js").click()
  await expect
    .element(card().getByText("bundle.js is 3 MB, over the 2 MB ivin shows, so it is not shown."))
    .toBeVisible()
  await item("logo.png").click()
  await expect
    .element(card().getByText("logo.png is a binary file, so it is not shown."))
    .toBeVisible()
})

test("a file that is gone says so in its place, and Retry reads it again", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("gone.ts").click()

  await expect
    .element(card().getByText("gone.ts no longer exists. Retry once it is back."))
    .toBeVisible()
  server.files.set(`${project}/gone.ts`, { kind: "text", text: "back()\n" })
  await card().getByRole("button", { name: "Retry" }).click()
  await expect.element(code("gone.ts")).toHaveTextContent("back()")
})

test("a file that cannot be read says to check its permissions", async () => {
  const server = makeServer()
  server.files.set(`${project}/gone.ts`, "unreadable")
  await mount(server)
  await showFiles()
  await item("gone.ts").click()
  await expect
    .element(card().getByText("gone.ts could not be read. Check its permissions, then retry."))
    .toBeVisible()
})

test("switching sessions and back keeps the open files and the selected one", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()
  await fileTab("README.md").click()

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect.element(card()).not.toBeInTheDocument()
  await sessionTab("Checkout flow").getByRole("tab").click()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("logo.png")).toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
})

test("the open files are back at launch, from the server", async () => {
  const server = makeServer()
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews: [
      { kind: "file", path: "README.md" },
      { kind: "file", path: "src/main.ts" },
    ],
    selected: { kind: "file", path: "src/main.ts" },
  })
  await mount(server)
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("README.md")).toBeVisible()
  await expect.element(code("main.ts")).toHaveTextContent('export const shop = "open"')
})

test("a file opened with Enter in the tree keeps the focus in the tree", async () => {
  await mount(makeServer())
  await showFiles()
  ;(page.getByRole("tree", { name: "Files" }).element() as HTMLElement).focus()
  await userEvent.keyboard("{End}{Enter}")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(page.getByRole("tree", { name: "Files" })).toHaveFocus()
})
