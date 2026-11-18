import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ActionSheet } from "./action-sheet.tsx"

test("the sheet is a group named by its title and shows the detail, the content and the hint", async () => {
  await render(
    <ActionSheet title="Approval needed" detail="pnpm test" hint="Enter to answer">
      <button type="button">Answer</button>
    </ActionSheet>,
  )
  const sheet = page.getByRole("group", { name: "Approval needed" })
  await expect.element(sheet).toBeVisible()
  await expect.element(sheet.getByText("pnpm test")).toHaveAttribute("title", "pnpm test")
  await expect.element(sheet.getByRole("button", { name: "Answer" })).toBeVisible()
  await expect.element(sheet.getByText("Enter to answer")).toBeVisible()
})

test("the tone defaults to neutral and the danger tone is exposed for styling", async () => {
  await render(<ActionSheet title="One" data-testid="neutral" />)
  await render(<ActionSheet title="Two" tone="danger" data-testid="danger" />)
  await expect.element(page.getByTestId("neutral")).toHaveAttribute("data-tone", "neutral")
  await expect.element(page.getByTestId("danger")).toHaveAttribute("data-tone", "danger")
})

test("the optional parts are left out when absent", async () => {
  await render(<ActionSheet title="Bare" />)
  const sheet = page.getByRole("group", { name: "Bare" })
  expect(sheet.element().querySelector(".iv-action-sheet__detail")).toBeNull()
  expect(sheet.element().querySelector(".iv-action-sheet__hint")).toBeNull()
})
