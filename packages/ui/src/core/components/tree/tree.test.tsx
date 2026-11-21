import { useState } from "react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TreeRow } from "@ivin/plugin-api/ui"
import { Tree } from "./tree.tsx"

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

function Harness() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  return (
    <div style={{ display: "flex", height: 300 }}>
      <Tree
        label="Files"
        rows={visible(nodes, open)}
        onToggle={(id) =>
          setOpen((current) => {
            const next = new Set(current)
            if (!next.delete(id)) next.add(id)
            return next
          })
        }
      />
    </div>
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
