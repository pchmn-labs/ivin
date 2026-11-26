import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { folder, mountApp } from "./test-app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"
const files = Array.from({ length: 40 }, (_, i) => `file-${String(i).padStart(2, "0")}.ts`)

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
  server.folders.set(project, folder("src/", "docs/", ...files, "README.md"))
  server.folders.set(`${project}/src`, folder("lib/", "main.ts"))
  server.folders.set(`${project}/src/lib`, folder("cart.ts"))
  server.folders.set(`${project}/docs`, folder("guide.md"))
  server.files.set(`${project}/README.md`, { kind: "text", text: "# Shop\n" })
  server.openTab("s1")
  return server
}

const mount = (server: FakeServer) => mountApp(server, { height: 800 })

const tree = () => page.getByRole("tree", { name: "Files" })
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const active = () => {
  const id = tree().element().getAttribute("aria-activedescendant")
  return id === null ? null : document.getElementById(id)?.getAttribute("aria-label")
}
const selected = () =>
  [...document.querySelectorAll('[role="treeitem"][aria-selected="true"]')].map((row) =>
    row.getAttribute("aria-label"),
  )

// Puts the focus in the tree, on its first row.
const focusTree = async (server = makeServer()) => {
  await mount(server)
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(tree()).toHaveFocus()
  await expect.element(item("src")).toBeVisible()
  return server
}

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("closing the folder that holds the active row makes the folder active", async () => {
  const server = makeServer()
  server.setUserKeybindings({
    keybindings: [{ key: "mod+shift+k", command: "files.collapseAll", when: null }],
    problem: null,
  })
  await focusTree(server)
  await userEvent.keyboard("{ArrowDown}{ArrowRight}{ArrowRight}")
  expect(active()).toBe("guide.md")
  await userEvent.keyboard(`{${mod}>}{Shift>}k{/Shift}{/${mod}}`)
  await expect.element(item("guide.md")).not.toBeInTheDocument()
  expect(active()).toBe("docs")
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
  expect(selected()).toEqual(["docs", "file-00.ts"])
})

test("a key of the tree can be bound to another key in keybindings.json", async () => {
  const server = makeServer()
  server.setUserKeybindings({
    keybindings: [
      { key: "ctrl+n", command: "tree.focusNext", when: "tree" },
      { key: "arrowdown", command: "-tree.focusNext", when: "tree" },
    ],
    problem: null,
  })
  await focusTree(server)
  await userEvent.keyboard("{Control>}n{/Control}")
  expect(active()).toBe("docs")
  await userEvent.keyboard("{ArrowDown}")
  expect(active()).toBe("docs")
})

test("Collapse all folders closes every open folder", async () => {
  const server = makeServer()
  server.setUserKeybindings({
    keybindings: [{ key: "mod+shift+k", command: "files.collapseAll", when: null }],
    problem: null,
  })
  await focusTree(server)
  await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
  await expect.element(item("cart.ts")).toBeVisible()
  await item("docs").click()
  await expect.element(item("guide.md")).toBeVisible()

  await userEvent.keyboard(`{${mod}>}{Shift>}k{/Shift}{/${mod}}`)
  await expect.element(item("lib")).not.toBeInTheDocument()
  await expect.element(item("guide.md")).not.toBeInTheDocument()
  await expect.element(item("src")).toHaveAttribute("aria-expanded", "false")
})

test("the Collapse all folders button closes every open folder, and is disabled with none open", async () => {
  await focusTree()
  const collapse = page.getByRole("button", { name: "Collapse all folders" })
  await expect.element(collapse).toBeDisabled()
  await item("docs").click()
  await expect.element(item("guide.md")).toBeVisible()
  await expect.element(collapse).toBeEnabled()

  await collapse.click()
  await expect.element(item("guide.md")).not.toBeInTheDocument()
  await expect.element(collapse).toBeDisabled()
})
