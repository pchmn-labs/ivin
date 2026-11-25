import { RegistryProvider } from "@effect/atom-react"
import { useState, type ReactNode } from "react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { defaultSettings } from "@ivin/contracts/setting"
import type { TreeRow } from "@ivin/plugin-api/ui"
import { useKeyboardHandler } from "../../../modules/keybinding/hooks/use-keyboard-handler.ts"
import { makeFakeServer, type FakeServer } from "../../fake-server-client.ts"
import { serverClientLayerAtom } from "../../server-client.ts"
import { Tree } from "./tree.tsx"

// The tree's keys are commands, run by the window's keyboard handler.
function WithKeys({ children, server: given }: { children: ReactNode; server?: FakeServer }) {
  const [server] = useState(() => given ?? makeFakeServer())
  return (
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <KeyboardHandler />
      {children}
    </RegistryProvider>
  )
}

function KeyboardHandler() {
  useKeyboardHandler()
  return null
}

interface Node {
  readonly name: string
  readonly children?: ReadonlyArray<Node>
}

const nodes: ReadonlyArray<Node> = [
  {
    name: "src",
    children: [{ name: "lib", children: [{ name: "deep.ts" }] }, { name: "main.ts" }],
  },
  { name: "docs", children: [{ name: "guide.md" }] },
  { name: "README.md" },
]

const visible = (list: ReadonlyArray<Node>, open: ReadonlySet<string>, base = "", depth = 0) =>
  list.flatMap((node): TreeRow[] => {
    const id = base + node.name
    const row = {
      id,
      name: node.name,
      depth,
      expanded: node.children ? open.has(id) : null,
    }
    return node.children && open.has(id)
      ? [row, ...visible(node.children, open, `${id}/`, depth + 1)]
      : [row]
  })

function Harness({ onOpen, server }: { onOpen?: (id: string) => void; server?: FakeServer }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  return (
    <WithKeys {...(server && { server })}>
      <div style={{ display: "flex", height: 300 }}>
        <Tree
          label="Files"
          rows={visible(nodes, open)}
          {...(onOpen && { onOpen })}
          onToggle={(id) =>
            setOpen((current) => {
              const next = new Set(current)
              if (!next.delete(id)) next.add(id)
              return next
            })
          }
        />
      </div>
    </WithKeys>
  )
}

const tree = () => page.getByRole("tree", { name: "Files" })
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const names = () =>
  [...document.querySelectorAll('[role="treeitem"]')].map((row) => row.textContent?.trim())
const active = () => {
  const id = tree().element().getAttribute("aria-activedescendant")
  return id === null ? null : document.getElementById(id)?.textContent?.trim()
}

test("a click on a folder opens and closes it", async () => {
  await render(<Harness />)
  await item("src").click()
  await expect.element(item("main.ts")).toBeVisible()
  await expect.element(item("src")).toHaveAttribute("aria-expanded", "true")
  await item("src").click()
  await expect.element(item("main.ts")).not.toBeInTheDocument()
})

const left = (row: string, part: string) =>
  item(row).element().querySelector(part)?.getBoundingClientRect().left ?? Number.NaN

test("a file's icon starts where the icons of the folders beside it do", async () => {
  await render(<Harness />)
  await expect
    .poll(() => left("README.md", ".iv-tree__icon") - left("src", ".iv-tree__icon"))
    .toBe(0)
})

test("with folder icons off, a file's icon takes the place of the folders' chevrons, and file and folder names start together", async () => {
  const server = makeFakeServer()
  server.setUserSettings({
    settings: { ...defaultSettings, files: { folderIcons: false } },
    problem: null,
  })
  await render(<Harness server={server} />)
  await expect.poll(() => item("src").element().querySelector(".iv-tree__icon")).toBeNull()
  await expect
    .poll(() => left("README.md", ".iv-tree__name") - left("src", ".iv-tree__name"))
    .toBe(0)
  await expect
    .poll(() => left("README.md", ".iv-tree__icon") - left("src", ".iv-tree__chevron"))
    .toBe(0)
})

test("the arrows move, open and close, and the active row stays visible", async () => {
  await render(<Harness />)
  await expect.element(item("src")).toBeVisible()
  await userEvent.tab()
  await expect.element(tree()).toHaveFocus()
  expect(active()).toBe("src")
  await expect.element(item("src")).toHaveAttribute("data-active")

  await userEvent.keyboard("{ArrowRight}")
  await expect.element(item("lib")).toBeVisible()
  expect(active()).toBe("src")
  await userEvent.keyboard("{ArrowRight}")
  expect(active()).toBe("lib")
  await userEvent.keyboard("{ArrowRight}{ArrowRight}")
  expect(active()).toBe("deep.ts")
  await userEvent.keyboard("{ArrowDown}")
  expect(active()).toBe("main.ts")
  await userEvent.keyboard("{ArrowLeft}")
  expect(active()).toBe("src")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(item("lib")).not.toBeInTheDocument()
  expect(names()).toEqual(["src", "docs", "README.md"])

  await userEvent.keyboard("{End}")
  expect(active()).toBe("README.md")
  await userEvent.keyboard("{ArrowUp}{Enter}")
  await expect.element(item("guide.md")).toBeVisible()
  await userEvent.keyboard("{Home}")
  expect(active()).toBe("src")
})

test("a click makes the row active", async () => {
  await render(<Harness />)
  await item("README.md").click()
  expect(active()).toBe("README.md")
  await expect.element(item("README.md")).toHaveAttribute("aria-selected", "true")
})

test("only the rows in view are in the page", async () => {
  const many = Array.from({ length: 5_000 }, (_, i) => ({
    id: String(i),
    name: `file-${i}.ts`,
    depth: 0,
    expanded: null,
  }))
  await render(
    <div style={{ display: "flex", height: 300 }}>
      <Tree label="Files" rows={many} onToggle={() => undefined} />
    </div>,
  )
  await expect.element(item("file-0.ts")).toBeVisible()
  expect(names().length).toBeLessThan(100)
})

test("no row looks active until the tree takes the focus or a row is clicked", async () => {
  await render(<Harness />)
  await expect.element(item("src")).toBeVisible()
  expect(document.querySelector("[data-active]")).toBeNull()
  await userEvent.tab()
  await expect.element(item("src")).toHaveAttribute("data-active")
})

test("a click, Enter or Space on a file opens it; on a folder it does not", async () => {
  const opened: string[] = []
  await render(<Harness onOpen={(id) => opened.push(id)} />)
  await page.getByRole("treeitem", { name: "README.md" }).click()
  await page.getByRole("treeitem", { name: "docs" }).click()
  await userEvent.keyboard("{ArrowDown}{Enter}{ }")
  expect(opened).toEqual(["README.md", "docs/guide.md", "docs/guide.md"])
})

test("the rows carry their level, and the active row shows a focus ring while the tree has the keyboard focus", async () => {
  await render(<Harness />)
  await expect.element(tree()).toHaveAttribute("aria-multiselectable", "true")
  await item("src").click()
  await expect.element(item("lib")).toHaveAttribute("aria-level", "2")
  await expect.element(item("src")).toHaveAttribute("aria-level", "1")
  expect(getComputedStyle(item("src").element()).outlineStyle).toBe("none")

  await userEvent.keyboard("{ArrowDown}")
  expect(getComputedStyle(item("lib").element()).outlineStyle).toBe("solid")
})

test("a row shows its git status: the name's colour, and a letter for a file or a dot for a folder", async () => {
  await render(
    <WithKeys>
      <div style={{ display: "flex", height: 300 }}>
        <Tree
          label="Files"
          rows={[
            { id: "src", name: "src", depth: 0, expanded: false, status: "modified" },
            { id: "a.ts", name: "a.ts", depth: 0, expanded: null, status: "untracked" },
            { id: "dist", name: "dist", depth: 0, expanded: false, status: "ignored" },
            { id: "b.ts", name: "b.ts", depth: 0, expanded: null },
          ]}
          onToggle={() => undefined}
        />
      </div>
    </WithKeys>,
  )
  const row = (name: string) => page.getByRole("treeitem", { name, exact: true })
  await expect.element(row("a.ts")).toHaveAttribute("data-status", "untracked")
  await expect.element(row("a.ts")).toHaveAccessibleDescription("Untracked")
  expect(row("a.ts").element().textContent).toBe("a.tsU")
  await expect.element(row("src")).toHaveAccessibleDescription("Has changes")
  expect(row("src").element().querySelector(".iv-tree__dot")).not.toBeNull()
  await expect.element(row("dist")).toHaveAccessibleDescription("Ignored by git")
  expect(row("dist").element().textContent).toBe("dist")
  await expect.element(row("b.ts")).not.toHaveAttribute("data-status")
})

test("the matched part of a name is highlighted", async () => {
  await render(
    <WithKeys>
      <div style={{ display: "flex", height: 300 }}>
        <Tree
          label="Files"
          rows={[{ id: "cart.ts", name: "cart.ts", depth: 0, expanded: null, match: [1, 3] }]}
          onToggle={() => undefined}
        />
      </div>
    </WithKeys>,
  )
  await expect.element(page.getByRole("treeitem", { name: "cart.ts" })).toBeVisible()
  expect(document.querySelector(".iv-tree__match")?.textContent).toBe("ar")
})

test("revealId selects its row and scrolls it into view, once it is among the rows", async () => {
  const many: ReadonlyArray<TreeRow> = Array.from({ length: 200 }, (_, i) => ({
    id: `f${i}`,
    name: `file-${i}.ts`,
    depth: 0,
    expanded: null,
  }))
  function Reveal() {
    const [rows, setRows] = useState<ReadonlyArray<TreeRow>>(many.slice(0, 10))
    const [revealId, setRevealId] = useState<string | null>(null)
    return (
      <WithKeys>
        <button type="button" onClick={() => setRevealId("f150")}>
          reveal
        </button>
        <button type="button" onClick={() => setRows(many)}>
          load
        </button>
        <div style={{ display: "flex", height: 300 }}>
          <Tree label="Files" rows={rows} onToggle={() => undefined} revealId={revealId} />
        </div>
      </WithKeys>
    )
  }
  await render(<Reveal />)
  await page.getByRole("button", { name: "reveal" }).click()
  await page.getByRole("button", { name: "load" }).click()
  const row = page.getByRole("treeitem", { name: "file-150.ts" })
  await expect.element(row).toBeInViewport()
  await expect.element(row).toHaveAttribute("aria-selected", "true")
})
