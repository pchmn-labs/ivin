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

test("the tone defaults to neutral and the attention tone is exposed for styling", async () => {
  await render(<ActionSheet title="One" data-testid="neutral" />)
  await render(<ActionSheet title="Two" tone="attention" data-testid="attention" />)
  await expect.element(page.getByTestId("neutral")).toHaveAttribute("data-tone", "neutral")
  await expect.element(page.getByTestId("attention")).toHaveAttribute("data-tone", "attention")
})

test("the optional parts are left out when absent", async () => {
  await render(<ActionSheet title="Bare" />)
  const sheet = page.getByRole("group", { name: "Bare" })
  expect(sheet.element().querySelector(".iv-action-sheet__detail")).toBeNull()
  expect(sheet.element().querySelector(".iv-action-sheet__hint")).toBeNull()
})

test("a click on the sheet outside its controls focuses its first control", async () => {
  await render(
    <ActionSheet title="Approval needed" detail="pnpm test">
      <button type="button" tabIndex={-1}>
        Skipped
      </button>
      <button type="button">Answer</button>
    </ActionSheet>,
  )
  await page.getByText("pnpm test").click()
  await expect.element(page.getByRole("button", { name: "Answer" })).toHaveFocus()
})
