import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { LoadingRows } from "./loading-rows.tsx"

test("with a label the rows are announced as a status", async () => {
  await render(<LoadingRows label="Loading" />)
  await expect.element(page.getByRole("status", { name: "Loading" })).toBeVisible()
})

test("without a label the rows are hidden from assistive technology", async () => {
  const { container } = await render(<LoadingRows />)
  expect(page.getByRole("status").elements()).toHaveLength(0)
  expect(container.querySelector(".iv-loading-rows")?.getAttribute("aria-hidden")).toBe("true")
})
