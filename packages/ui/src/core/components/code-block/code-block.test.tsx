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
