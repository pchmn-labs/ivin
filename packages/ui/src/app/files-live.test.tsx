import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
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

// A trailing `/` makes a folder, a leading `!` an entry git ignores.
const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((raw) => {
    const ignored = raw.startsWith("!")
    const name = ignored ? raw.slice(1) : raw
    return name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored }
      : { name, kind: "file", ignored }
  })

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
  server.folders.set(project, folder("src/", "docs/", "!dist/", "README.md", "!.env"))
  server.folders.set(`${project}/src`, folder("lib/", "main.ts"))
  server.folders.set(`${project}/src/lib`, folder("cart.ts"))
  server.folders.set(`${project}/docs`, folder("guide.md"))
  server.folders.set(`${project}/dist`, folder("!bundle.js"))
  server.files.set(`${project}/src/lib/cart.ts`, { kind: "text", text: "export const cart = 1\n" })
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
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(item("src")).toBeVisible()
  return server
}

const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const filter = () => page.getByRole("textbox", { name: "Filter files by name" })
const filterButton = () => page.getByRole("button", { name: "Filter files", exact: true })
const openFilter = async () => {
  await filterButton().click()
  await expect.element(filter()).toHaveFocus()
  return filter()
}
const goToFile = () => page.getByRole("combobox", { name: "Go to file" })
const openFiles = () => page.getByRole("region", { name: "Open files" })

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("a file created on disk shows in its open folder, and one deleted goes away", async () => {
  const server = await mount(makeServer())
  await item("src").click()
  await expect.element(item("main.ts")).toBeVisible()

  server.folders.set(`${project}/src`, folder("lib/", "main.ts", "total.ts"))
  server.changeOnDisk(project, ["src/total.ts"])
  await expect.element(item("total.ts")).toBeVisible()

  server.folders.set(`${project}/src`, folder("lib/", "total.ts"))
  server.changeOnDisk(project, ["src/main.ts"])
  await expect.element(item("main.ts")).not.toBeInTheDocument()
})

test("a folder deleted on disk leaves the tree, with no error", async () => {
  const server = await mount(makeServer())
  await item("docs").click()
  await expect.element(item("guide.md")).toBeVisible()

  server.folders.delete(`${project}/docs`)
  server.folders.set(project, folder("src/", "!dist/", "README.md", "!.env"))
  server.changeOnDisk(project, ["docs/guide.md", "docs"])
  await expect.element(item("docs")).not.toBeInTheDocument()
  await expect.element(item("guide.md")).not.toBeInTheDocument()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})

test("rows take the colour of their git status, and so do the folders above a changed file", async () => {
  const server = makeServer()
  server.gitStatus.set(project, [
    { path: "README.md", status: "modified" },
    { path: "src/lib/cart.ts", status: "added" },
  ])
  await mount(server)
  await expect.element(item("README.md")).toHaveAttribute("data-status", "modified")
  await expect.element(item("src")).toHaveAttribute("data-status", "added")
  await expect.element(item("docs")).not.toHaveAttribute("data-status")

  server.gitStatus.set(project, [{ path: "src/lib/cart.ts", status: "added" }])
  server.changeOnDisk(project, [])
  await expect.element(item("README.md")).not.toHaveAttribute("data-status")
})

test("the git status follows the session into the worktree its agent moves to", async () => {
  const worktree = `${project}/.worktrees/fix-cart`
  const server = makeServer()
  server.folders.set(worktree, folder("src/", "README.md"))
  await mount(server)
  await expect.element(item("docs")).toBeVisible()

  server.moveSession("s1", worktree)
  await expect.element(item("docs")).not.toBeInTheDocument()
  server.gitStatus.set(worktree, [{ path: "README.md", status: "modified" }])
  server.changeOnDisk(worktree, ["README.md"])
  await expect.element(item("README.md")).toHaveAttribute("data-status", "modified")
})

test("when git cannot read which files changed, a message with Retry shows above a tree that stays usable", async () => {
  const server = makeServer()
  server.gitStatus.set(project, [{ path: "README.md", status: "modified" }])
  server.failNextCall("file.gitStatus")
  await mount(server)
  await expect
    .element(
      page.getByText("Git could not read which files changed, so the files show no status. Retry."),
    )
    .toBeVisible()
  await expect.element(item("README.md")).not.toHaveAttribute("data-status")
  await item("src").click()
  await expect.element(item("main.ts")).toBeVisible()

  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(item("README.md")).toHaveAttribute("data-status", "modified")
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})

test("Go to file shows a listing that failed with Retry, and lists again on Retry", async () => {
  const server = makeServer()
  await mount(server)
  server.failNextCall("file.listFiles")
  await userEvent.keyboard(`{${mod}>}p{/${mod}}`)
  await expect
    .element(page.getByText("The working folder's files could not be listed. Retry."))
    .toBeVisible()

  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("4 files")).toBeVisible()
})

test("the eye button shows what git ignores, marked as ignored, and hides it again", async () => {
  await mount(makeServer())
  await expect.element(item("dist")).not.toBeInTheDocument()

  await page.getByRole("button", { name: "Show ignored files" }).click()
  await expect.element(item("dist")).toHaveAttribute("data-status", "ignored")
  await expect.element(item(".env")).toBeVisible()
  await item("dist").click()
  await expect.element(item("bundle.js")).toHaveAttribute("data-status", "ignored")

  await page.getByRole("button", { name: "Hide ignored files" }).click()
  await expect.element(item("dist")).not.toBeInTheDocument()
  await expect.element(item(".env")).not.toBeInTheDocument()
})

test("the filter keeps the files whose name holds the text, in every folder, opened", async () => {
  await mount(makeServer())
  await (await openFilter()).fill("CART")
  await expect.element(item("cart.ts")).toBeVisible()
  await expect.element(item("lib")).toHaveAttribute("aria-expanded", "true")
  await expect.element(item("main.ts")).not.toBeInTheDocument()
  await expect.element(item("README.md")).not.toBeInTheDocument()

  await userEvent.keyboard("{Escape}")
  await expect.element(filter()).toHaveValue("")
  await expect.element(item("README.md")).toBeVisible()
  await expect.element(item("cart.ts")).not.toBeInTheDocument()

  await userEvent.keyboard("{Escape}")
  await expect.element(filter()).not.toBeInTheDocument()
  await expect.element(filterButton()).toBeVisible()
})

test("the filter follows the disk, and says so when nothing matches", async () => {
  const server = await mount(makeServer())
  await (await openFilter()).fill("total")
  await expect.element(page.getByText("No file matches “total”.")).toBeVisible()

  server.folders.set(`${project}/src`, folder("lib/", "main.ts", "total.ts"))
  server.changeOnDisk(project, ["src/total.ts"])
  await expect.element(item("total.ts")).toBeVisible()
})

test("Go to file, by keyboard only, opens the file and the tree reveals it", async () => {
  await mount(makeServer())
  await userEvent.keyboard(`{${mod}>}p{/${mod}}`)
  await expect.element(goToFile()).toHaveFocus()
  await userEvent.keyboard("crt")
  await expect
    .element(page.getByRole("option", { name: "cart.ts src/lib" }))
    .toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard("{Enter}")

  await expect.element(goToFile()).not.toBeInTheDocument()
  await expect.element(openFiles().getByRole("tab", { name: "cart.ts" })).toBeVisible()
  await expect.element(item("src")).toHaveAttribute("aria-expanded", "true")
  await expect.element(item("cart.ts")).toHaveAttribute("aria-selected", "true")
})

test("Go to file says when no file matches, and Escape closes it", async () => {
  await mount(makeServer())
  await userEvent.keyboard(`{${mod}>}p{/${mod}}`)
  await expect.element(goToFile()).toHaveFocus()
  await expect.element(page.getByText("4 files")).toBeVisible()
  await userEvent.keyboard("zzz")
  await expect.element(page.getByText("No file in the working folder matches “zzz”.")).toBeVisible()

  await userEvent.keyboard("{Escape}")
  await expect.element(goToFile()).not.toBeInTheDocument()
  await expect.element(page.getByRole("tree", { name: "Files" })).toHaveFocus()
})
