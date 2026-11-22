import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Switch } from "./switch.tsx"

test("a click or Space turns the switch over, and a disabled switch does neither", async () => {
  const onChange = vi.fn()
  const { rerender } = await render(<Switch label="Stop the agent" checked onChange={onChange} />)
  const control = page.getByRole("switch", { name: "Stop the agent" })
  await expect.element(control).toBeChecked()

  await control.click()
  expect(onChange).toHaveBeenLastCalledWith(false)
  await userEvent.keyboard(" ")
  expect(onChange).toHaveBeenCalledTimes(2)

  await rerender(<Switch label="Stop the agent" checked onChange={onChange} disabled />)
  await expect.element(control).toBeDisabled()
  await control.click({ force: true })
  expect(onChange).toHaveBeenCalledTimes(2)
})
