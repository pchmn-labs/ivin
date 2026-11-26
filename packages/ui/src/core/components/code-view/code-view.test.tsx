import { EditorView } from "@codemirror/view"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
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

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"

const editor = async (text: string, fileName = "notes") => {
  const changes: string[] = []
  await render(
    <div style={{ height: 300, display: "flex" }}>
      <CodeView text={text} fileName={fileName} onChange={(next) => changes.push(next)} />
    </div>,
  )
  return {
    content: page.getByRole("textbox", { name: fileName }),
    changed: () => changes.at(-1),
  }
}

test("with a change handler, the text can be edited and each edit reports the new text", async () => {
  const { content, changed } = await editor("hello")
  await expect.element(content).not.toHaveAttribute("aria-readonly", "true")
  await page.getByText("hello").click()
  await userEvent.keyboard("{End}")
  await userEvent.keyboard(" world")
  await expect.poll(changed).toBe("hello world")
  await userEvent.keyboard(`{${mod}>}z{/${mod}}`)
  await expect.poll(changed).toBe("hello")
})

test("a file with Windows line endings keeps them", async () => {
  const { changed } = await editor("one\r\ntwo\r\n")
  await page.getByText("two").click()
  await userEvent.keyboard("{End}!")
  await expect.poll(changed).toBe("one\r\ntwo!\r\n")
})

test("a file with mixed line endings is written with the one most of its lines end with", async () => {
  const { changed } = await editor("one\r\ntwo\r\nthree\n")
  await page.getByText("three").click()
  await userEvent.keyboard("{End}!")
  await expect.poll(changed).toBe("one\r\ntwo\r\nthree!\r\n")
})

test("Escape in the editor stays in it", async () => {
  const escapes: string[] = []
  const listen = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) escapes.push(event.key)
  }
  window.addEventListener("keydown", listen)
  await editor("hello")
  await page.getByText("hello").click()
  await userEvent.keyboard("{Escape}")
  window.removeEventListener("keydown", listen)
  expect(escapes).toEqual([])
})

test("Alt+Down moves the line down", async () => {
  const { changed } = await editor("alpha\nbeta\ngamma")
  await page.getByText("beta").click()
  await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
  await expect.poll(changed).toBe("alpha\ngamma\nbeta")
})

test("Alt+click adds a cursor", async () => {
  const { changed } = await editor("ab\nab")
  await page.getByText("ab").first().click()
  await userEvent.keyboard("{End}")
  const secondLine = page.elementLocator(document.querySelectorAll(".cm-line")[1]!)
  await secondLine.click({ position: { x: 1, y: 5 }, modifiers: ["Alt"] })
  await userEvent.keyboard("x")
  await expect.poll(changed).toBe("abx\nxab")
})

test("Mod+/ comments the line out in the file's language", async () => {
  const { changed } = await editor("const a = 1", "main.ts")
  await expect.element(page.getByText("const")).toHaveClass("iv-syntax-keyword")
  await page.getByText("const").click()
  await userEvent.keyboard(`{${mod}>}/{/${mod}}`)
  await expect.poll(changed).toBe("// const a = 1")
})

test("Ctrl+G goes to a line", async () => {
  await editor(numbered(500))
  await page.getByText("line 1", { exact: true }).click()
  await userEvent.keyboard("{Control>}g{/Control}")
  await page.getByRole("textbox", { name: /Go to line/ }).fill("400")
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByText("line 400", { exact: true })).toBeInViewport()
})

test("extensions passed in take effect, and a new set replaces them", async () => {
  const marked = (value: string) => EditorView.contentAttributes.of({ "data-mark": value })
  const view = (value: string) => (
    <CodeView text="a" fileName="notes" extensions={[marked(value)]} />
  )
  const { rerender } = await render(view("first"))
  const content = page.getByRole("textbox", { name: "notes" })
  await expect.element(content).toHaveAttribute("data-mark", "first")
  await rerender(view("second"))
  await expect.element(content).toHaveAttribute("data-mark", "second")
})
