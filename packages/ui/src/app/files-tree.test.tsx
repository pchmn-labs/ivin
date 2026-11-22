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
const files = Array.from({ length: 40 }, (_, i) => `file-${String(i).padStart(2, "0")}.ts`)

const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored: false }
      : { name, kind: "file", ignored: false },
  )

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

const mount = (server: FakeServer) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 800 }}>
        <App />
      </div>
    </RegistryProvider>,
  )

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
const openFiles = () => page.getByRole("region", { name: "Open files" })

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

test("Up and Down move, Home and End jump to the ends", async () => {
  await focusTree()
  expect(active()).toBe("src")
  await userEvent.keyboard("{ArrowDown}")
  expect(active()).toBe("docs")
  await userEvent.keyboard("{ArrowUp}{ArrowUp}")
  expect(active()).toBe("src")
  await userEvent.keyboard("{End}")
  expect(active()).toBe("README.md")
  await expect.element(item("README.md")).toBeVisible()
  await userEvent.keyboard("{Home}")
  expect(active()).toBe("src")
})

test("Page Down goes to the last row in view, then a page further; Page Up the same way up", async () => {
  await focusTree()
  const scroller = document.querySelector<HTMLElement>(".iv-tree__list")!
  const lastInView = () => {
    const bottom = scroller.getBoundingClientRect().bottom
    const rows = [...scroller.querySelectorAll('[role="treeitem"]')]
    return rows
      .findLast((row) => row.getBoundingClientRect().bottom <= bottom + 1)
      ?.getAttribute("aria-label")
  }
  const last = lastInView()!
  await userEvent.keyboard("{PageDown}")
  expect(active()).toBe(last)
  expect(scroller.scrollTop).toBe(0)
  await userEvent.keyboard("{PageDown}")
  const order = ["src", "docs", ...files, "README.md"]
  expect(order.indexOf(active()!)).toBeGreaterThan(order.indexOf(last))
  await expect.element(item(active()!)).toBeVisible()
  await userEvent.keyboard("{PageUp}{PageUp}{PageUp}")
  expect(active()).toBe("src")
  await userEvent.keyboard("{PageDown}{PageDown}{PageDown}{PageDown}")
  expect(active()).toBe("README.md")
})

test("Right opens a folder, then enters it; Left closes it, then goes to its parent", async () => {
  await focusTree()
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(item("lib")).toBeVisible()
  expect(active()).toBe("src")
  await userEvent.keyboard("{ArrowRight}")
  expect(active()).toBe("lib")
  await userEvent.keyboard("{ArrowRight}{ArrowRight}")
  expect(active()).toBe("cart.ts")
  await userEvent.keyboard("{ArrowRight}")
  expect(active()).toBe("cart.ts")

  await userEvent.keyboard("{ArrowLeft}")
  expect(active()).toBe("lib")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(item("cart.ts")).not.toBeInTheDocument()
  expect(active()).toBe("lib")
  await userEvent.keyboard("{ArrowLeft}")
  expect(active()).toBe("src")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(item("lib")).not.toBeInTheDocument()
})

test("a move selects the row it lands on; Shift with Up or Down extends the selection", async () => {
  await focusTree()
  await userEvent.keyboard("{ArrowDown}{ArrowDown}")
  expect(selected()).toEqual(["file-00.ts"])
  await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
  expect(selected()).toEqual(["file-00.ts", "file-01.ts", "file-02.ts"])
  expect(active()).toBe("file-02.ts")
  await userEvent.keyboard("{Shift>}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}")
  expect(selected()).toEqual(["docs", "file-00.ts"])
  await userEvent.keyboard("{ArrowDown}")
  expect(selected()).toEqual(["file-00.ts"])
})

test("the first Shift move after the tree takes the focus selects from the active row", async () => {
  await focusTree()
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
  expect(selected()).toEqual(["src", "docs"])
})

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

test("Shift-click extends the selection and ⌘-click adds or removes a row, without opening files", async () => {
  const server = await focusTree()
  await item("file-01.ts").click({ modifiers: [mod] })
  await item("file-01.ts").click({ modifiers: [mod] })
  await item("file-00.ts").click({ modifiers: [mod] })
  expect(selected()).toEqual(["file-00.ts"])
  await item("file-03.ts").click({ modifiers: ["Shift"] })
  expect(selected()).toEqual(["file-00.ts", "file-01.ts", "file-02.ts", "file-03.ts"])
  await item("file-01.ts").click({ modifiers: [mod] })
  expect(selected()).toEqual(["file-00.ts", "file-02.ts", "file-03.ts"])
  expect(active()).toBe("file-01.ts")
  await expect.element(openFiles()).not.toBeInTheDocument()
  expect(server.subViews.get("s1")?.subViews ?? []).toEqual([])

  await userEvent.keyboard("{End}")
  await item("README.md").click()
  expect(selected()).toEqual(["README.md"])
  await expect.element(openFiles()).toBeVisible()
})

test("typing a name jumps to the next row that starts with it", async () => {
  await focusTree()
  await userEvent.keyboard("re")
  expect(active()).toBe("README.md")
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await userEvent.keyboard("f")
  expect(active()).toBe("file-00.ts")
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await userEvent.keyboard("f")
  expect(active()).toBe("file-01.ts")
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await userEvent.keyboard("file-12")
  expect(active()).toBe("file-12.ts")
  await expect.element(item("file-12.ts")).toBeVisible()
})

test("a space continues a name being typed, and opens the row otherwise", async () => {
  const server = makeServer()
  server.folders.set(project, folder("a b.md", "a c.md", "README.md"))
  server.files.set(`${project}/a c.md`, { kind: "text", text: "c" })
  await mount(server)
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(item("a b.md")).toBeVisible()
  await userEvent.keyboard("a c")
  expect(active()).toBe("a c.md")
  await expect.element(openFiles()).not.toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await userEvent.keyboard(" ")
  await expect.element(openFiles()).toBeVisible()
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
