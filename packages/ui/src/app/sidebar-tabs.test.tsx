import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
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
  server.folders.set(project, folder("src/", "package.json", "README.md"))
  server.folders.set(`${project}/src`, folder("lib/", "main.ts"))
  server.folders.set(`${project}/src/lib`, folder("cart.ts"))
  server.folders.set(worktree, folder("cart/", "notes.md"))
  server.openTab("s1")
  server.openTab("s2")
  return server
}

const mount = (server: FakeServer) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <App />
    </RegistryProvider>,
  )

const sidebarTab = (name: string) =>
  page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name })
const tree = () => page.getByRole("tree", { name: "Files" })
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test("the list column opens on Sessions; Files shows the working folder of the session on screen", async () => {
  await mount(makeServer())
  await expect.element(sidebarTab("Sessions")).toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByRole("navigation", { name: "Sessions" })).toBeVisible()

  await sidebarTab("Files").click()
  await expect.element(sidebarTab("Files")).toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByRole("navigation", { name: "Sessions" })).not.toBeInTheDocument()
  await expect.element(item("cart")).toBeVisible()
  await expect.element(item("notes.md")).toBeVisible()
  await expect.element(page.getByText(".worktrees/fix-cart")).toBeVisible()

  await sidebarTab("Sessions").click()
  await expect.element(page.getByRole("navigation", { name: "Sessions" })).toBeVisible()
})

test("each tab has a keybinding, which also opens a hidden sidebar", async () => {
  await mount(makeServer())
  await expect.element(sidebarTab("Sessions")).toBeVisible()
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(tree()).toBeVisible()

  await userEvent.keyboard(`{${mod}>}1{/${mod}}`)
  await expect.element(page.getByRole("navigation", { name: "Sessions" })).toBeVisible()

  await page.getByRole("button", { name: "Toggle sidebar" }).click()
  await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(tree()).toBeVisible()
})

test("the tree follows the session on screen, and keeps each session's open folders", async () => {
  await mount(makeServer())
  await sidebarTab("Files").click()
  await item("cart").click()
  await expect.element(item("notes.md")).toBeVisible()

  await sessionTab("Checkout flow").click()
  await expect.element(item("package.json")).toBeVisible()
  await expect.element(item("notes.md")).not.toBeInTheDocument()
  await expect.element(page.getByText(".worktrees/fix-cart")).not.toBeInTheDocument()

  await sessionTab("Fix the cart").click()
  await expect.element(item("cart")).toHaveAttribute("aria-expanded", "true")
})

test("folders open one level at a time, by click and by the arrow keys", async () => {
  const server = makeServer()
  await mount(server)
  await sessionTab("Checkout flow").click()
  await sidebarTab("Files").click()
  await expect.element(item("src")).toBeVisible()
  expect(server.listedFolders).not.toContain(`${project}/src`)

  await item("src").click()
  await expect.element(item("main.ts")).toBeVisible()
  await expect.element(item("cart.ts")).not.toBeInTheDocument()

  await userEvent.keyboard("{ArrowDown}{ArrowRight}")
  await expect.element(item("cart.ts")).toBeVisible()
  await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}")
  await expect.element(item("main.ts")).not.toBeInTheDocument()
})

test("the selected tab is kept between launches", async () => {
  const first = await mount(makeServer())
  await sidebarTab("Files").click()
  await expect.element(tree()).toBeVisible()
  await first.unmount()

  await mount(makeServer())
  await expect.element(sidebarTab("Files")).toHaveAttribute("aria-selected", "true")
  await expect.element(tree()).toBeVisible()
})

test("with no session on screen, Files says so", async () => {
  const server = makeServer()
  await mount(server)
  await sidebarTab("Files").click()
  for (const title of ["Fix the cart", "Checkout flow"]) {
    await sessionTab(title).hover()
    await page.getByRole("button", { name: `Close ${title}` }).click()
  }
  await expect.element(page.getByText("No session on screen.", { exact: false })).toBeVisible()
})

test("an empty working folder says it is empty", async () => {
  const server = makeServer()
  server.folders.set(worktree, [])
  await mount(server)
  await sidebarTab("Files").click()
  await expect.element(page.getByText("This folder is empty.")).toBeVisible()
})

test("a deleted working folder says so, with no retry", async () => {
  const server = makeServer()
  server.folders.delete(worktree)
  await mount(server)
  await sidebarTab("Files").click()
  await expect
    .element(
      page.getByText("This session's working folder was deleted, so it has no files to show."),
    )
    .toBeVisible()
  await expect.element(page.getByRole("button", { name: "Retry" })).not.toBeInTheDocument()
})

test("a listing that fails shows why where the tree is, and Retry lists it again", async () => {
  const server = makeServer()
  server.failNextCall("file.listFolder")
  await mount(server)
  await sidebarTab("Files").click()
  await expect
    .element(page.getByText("The working folder could not be listed. Retry."))
    .toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(item("cart")).toBeVisible()
})

test("a tab's keybinding puts the focus in its panel", async () => {
  await mount(makeServer())
  await expect.element(sidebarTab("Sessions")).toBeVisible()
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(tree()).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}{ArrowUp}{ArrowRight}")
  await expect.element(item("cart")).toHaveAttribute("aria-expanded", "true")

  await userEvent.keyboard(`{${mod}>}1{/${mod}}`)
  await expect
    .element(
      page
        .getByRole("navigation", { name: "Sessions" })
        .getByRole("button", { name: /Fix the cart/ }),
    )
    .toHaveFocus()
})
