import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { CodeView } from "./code-view.tsx"

test("shows the text with line numbers, read only, and highlights it once its language loads", async () => {
  await render(<CodeView text={'const a = "x"\n// note\n'} fileName="main.ts" />)
  const content = page.getByRole("textbox", { name: "main.ts" })
  await expect.element(content).toHaveTextContent('const a = "x"// note')
  await expect.element(content).toHaveAttribute("aria-readonly", "true")
  await expect.element(page.getByText("2", { exact: true })).toBeVisible()
  await expect.element(page.getByText("const")).toHaveClass("iv-syntax-keyword")
})

test("a new text replaces the shown one", async () => {
  const { rerender } = await render(<CodeView text="first" fileName="notes" />)
  await rerender(<CodeView text="second" fileName="notes" />)
  await expect.element(page.getByRole("textbox", { name: "notes" })).toHaveTextContent("second")
})

test("wraps the long lines of a Markdown file", async () => {
  await render(<CodeView text={"word ".repeat(400)} fileName="notes.md" />)
  await expect
    .element(page.getByRole("textbox", { name: "notes.md" }))
    .toHaveClass("cm-lineWrapping")
})

test("keeps the long lines of code whole", async () => {
  await render(<CodeView text={"word ".repeat(400)} fileName="main.ts" />)
  await expect
    .element(page.getByRole("textbox", { name: "main.ts" }))
    .not.toHaveClass("cm-lineWrapping")
})

const numbered = (count: number) =>
  Array.from({ length: count }, (_, i) => `line ${i + 1}`).join("\n")

test("shown lines are scrolled into view and selected", async () => {
  await render(
    <div style={{ height: 200, display: "flex" }}>
      <CodeView
        text={numbered(500)}
        fileName="notes"
        shownLines={{ start: 300, end: 302, request: 1 }}
      />
    </div>,
  )
  await expect.element(page.getByText("line 300", { exact: true })).toBeInViewport()
  const selected = () => document.querySelectorAll(".cm-selectionBackground").length
  await expect.poll(selected).toBeGreaterThan(0)
})

test("a new request for other lines moves to them", async () => {
  const view = (start: number, request: number) => (
    <div style={{ height: 200, display: "flex" }}>
      <CodeView text={numbered(500)} fileName="notes" shownLines={{ start, end: start, request }} />
    </div>
  )
  const { rerender } = await render(view(300, 1))
  await expect.element(page.getByText("line 300", { exact: true })).toBeInViewport()
  await rerender(view(40, 2))
  await expect.element(page.getByText("line 40", { exact: true })).toBeInViewport()
})
