import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { FailureHeader, FailureSkeleton } from "./failure-state.tsx"

test("the header shows the message with its Retry and action", async () => {
  const retry = vi.fn()
  const reload = vi.fn()
  await render(
    <FailureHeader
      message="Part of the window could not be drawn."
      onRetry={retry}
      action={{ label: "Reload window", onSelect: reload }}
    />,
  )
  await expect.element(page.getByRole("alert")).toBeVisible()
  await expect.element(page.getByText("Part of the window could not be drawn.")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await page.getByRole("button", { name: "Reload window" }).click()
  expect(retry).toHaveBeenCalledOnce()
  expect(reload).toHaveBeenCalledOnce()
})

test("the skeleton is hidden from assistive technology", async () => {
  const { container } = await render(<FailureSkeleton />)
  expect(container.querySelector(".iv-failure__skeleton")?.getAttribute("aria-hidden")).toBe("true")
})
