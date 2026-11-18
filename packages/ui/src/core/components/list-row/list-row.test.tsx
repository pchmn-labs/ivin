import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ListRow } from "./list-row.tsx"

test("a row's subtitle sits on its own line under the title, and both are one button", async () => {
  await render(<ListRow title="Fix the cart" subtitle="shop" meta="3 min" />)
  const button = page.getByRole("button", { name: "Fix the cart shop 3 min" })
  await expect.element(button).toBeVisible()

  const title = page.getByText("Fix the cart").element().getBoundingClientRect()
  const subtitle = page.getByText("shop").element().getBoundingClientRect()
  expect(subtitle.top).toBeGreaterThanOrEqual(title.bottom)
  expect(subtitle.left).toBe(title.left)
})
