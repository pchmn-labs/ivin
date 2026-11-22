import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Markdown } from "./markdown.tsx"

test("a code block's Copy button puts its code on the clipboard", async () => {
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
  await render(<Markdown text={"Run:\n\n```sh\npnpm install\npnpm dev\n```\n"} />)
  await page.getByText("pnpm install", { exact: false }).hover()
  await page.getByRole("button", { name: "Copy" }).click()
  await expect.element(page.getByRole("button", { name: "Copied" })).toBeVisible()
  expect(writeText).toHaveBeenCalledWith("pnpm install\npnpm dev\n")
})

test("a table keeps each word of a narrow column on one line", async () => {
  const long = "word ".repeat(80)
  await render(
    <div style={{ width: 600 }}>
      <Markdown
        text={`| # | Variant | Cost |\n|---|---|---|\n| 1 | \`list.test.ts\` | ${long} |\n`}
      />
    </div>,
  )
  const cell = page.getByRole("cell", { name: "list.test.ts" })
  await expect.element(cell).toBeVisible()
  const range = document.createRange()
  range.selectNodeContents(cell.element().querySelector("code")!.firstChild!)
  expect(range.getClientRects()).toHaveLength(1)
})
