import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Steps } from "./steps.tsx"

const STEPS = [
  { label: "Runner", done: true },
  { label: "Folders", done: false },
  { label: "Snapshots", done: false },
]

test("each step shows its number or, once done, a check; the current one is marked", async () => {
  await render(<Steps label="Questions" steps={STEPS} current={1} />)
  const nav = page.getByRole("navigation", { name: "Questions" })
  await expect
    .element(nav.getByRole("button", { name: "Folders" }))
    .toHaveAttribute("aria-current", "step")
  await expect
    .element(nav.getByRole("button", { name: "Snapshots" }))
    .toHaveTextContent("3Snapshots")
  await expect.element(nav.getByRole("button", { name: "Runner" })).toHaveTextContent("Runner")
})

test("a click on a step selects it", async () => {
  const onSelect = vi.fn()
  await render(<Steps label="Questions" steps={STEPS} current={1} onSelect={onSelect} />)
  await userEvent.click(page.getByRole("button", { name: "Snapshots" }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(2)
})
