import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { CodeBlock } from "./code-block.tsx"

test("a code block's Copy button puts its text on the clipboard", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
  await render(<CodeBlock text={"error: pathspec 'main' did not match"} />)
  await page.getByText("error: pathspec", { exact: false }).hover()
  await page.getByRole("button", { name: "Copy" }).click()
  await expect.element(page.getByRole("button", { name: "Copied" })).toBeVisible()
  expect(writeText).toHaveBeenCalledWith("error: pathspec 'main' did not match")
})

test("a 5,000-line output shows 2,000 lines and a note, and Copy still copies all of it", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
  const text = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`).join("\n")
  await render(<CodeBlock text={text} data-testid="out" />)
  await expect.element(page.getByText("Showing the first 2,000 of 5,000 lines.")).toBeVisible()
  const shown = page.getByTestId("out").element().textContent ?? ""
  expect(shown.split("\n")).toHaveLength(2000)
  expect(shown.endsWith("line 2000")).toBe(true)
  await page.getByTestId("out").hover()
  await page.getByRole("button", { name: "Copy" }).click()
  expect(writeText).toHaveBeenCalledWith(text)
})

test("an output of 2,000 lines or fewer shows whole, with no note", async () => {
  const text = Array.from({ length: 2000 }, (_, i) => `line ${i + 1}`).join("\n")
  await render(<CodeBlock text={text} data-testid="out" />)
  expect(page.getByTestId("out").element().textContent).toBe(text)
  expect(document.body.textContent).not.toContain("Showing the first")
})
