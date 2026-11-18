import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ErrorMessage } from "./error-message.tsx"

test("the message is an alert, with no Retry when none is offered", async () => {
  await render(<ErrorMessage message="The folder was not opened." />)
  await expect.element(page.getByRole("alert")).toHaveTextContent("The folder was not opened.")
  expect(page.getByRole("button", { name: "Retry" }).query()).toBeNull()
})

test("Retry runs the action given", async () => {
  const retry = vi.fn()
  await render(<ErrorMessage message="The message was not sent." onRetry={retry} />)
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click()
  expect(retry).toHaveBeenCalledOnce()
})
