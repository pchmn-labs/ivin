import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { KeyHints } from "./key-hints.tsx"

test("each hint shows its key and what the key does", async () => {
  await render(
    <KeyHints
      hints={[
        { key: "↵", label: "Pick" },
        { key: "Esc", label: "Close" },
      ]}
    />,
  )
  await expect.element(page.getByText("Pick")).toBeVisible()
  await expect.element(page.getByText("Close")).toBeVisible()
  await expect.element(page.getByText("Esc")).toBeVisible()
})

test("arrow and Enter keys are icons that still name the key", async () => {
  await render(
    <KeyHints
      hints={[
        { key: "↑↓ ←→", label: "Move" },
        { key: "↵", label: "Pick" },
      ]}
    />,
  )
  await expect.element(page.getByRole("img", { name: "Up and down arrows" })).toBeVisible()
  await expect.element(page.getByRole("img", { name: "Left and right arrows" })).toBeVisible()
  await expect.element(page.getByRole("img", { name: "Enter" })).toBeVisible()
  expect(page.getByText("↵").elements()).toHaveLength(0)
})
