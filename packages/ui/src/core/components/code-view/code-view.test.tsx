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
