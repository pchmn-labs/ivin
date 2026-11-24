import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Disclosure } from "./disclosure.tsx"

test("a click opens the disclosure without focusing it, the keyboard still reaches it", async () => {
  await render(
    <>
      <button type="button">Before</button>
      <Disclosure summary="Output">file contents</Disclosure>
    </>,
  )
  await page.getByText("Output").click()
  await expect.element(page.getByText("file contents")).toBeVisible()
  expect(document.activeElement).toBe(document.body)
  page.getByRole("button", { name: "Before" }).element().focus()
  await userEvent.tab()
  expect(document.activeElement?.tagName).toBe("SUMMARY")
})

test("a folded disclosure's content is not in the page until it is unfolded", async () => {
  await render(<Disclosure summary="Output">file contents</Disclosure>)
  expect(document.body.textContent).not.toContain("file contents")
  await page.getByText("Output").click()
  await expect.element(page.getByText("file contents")).toBeVisible()
  await page.getByText("Output").click()
  await expect.element(page.getByText("file contents")).not.toBeInTheDocument()
})
