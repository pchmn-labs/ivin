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

test("a section's actions sit in its heading, folded or open, and using them does not fold it", async () => {
  let clicks = 0
  await render(
    <Disclosure
      variant="section"
      summary="Inactive sessions"
      actions={
        <button type="button" onClick={() => void clicks++}>
          More
        </button>
      }
    >
      rows
    </Disclosure>,
  )
  await page.getByRole("button", { name: "More" }).click()
  expect(clicks).toBe(1)
  expect(document.body.textContent).not.toContain("rows")

  await page.getByText("Inactive sessions").click()
  await expect.element(page.getByText("rows")).toBeVisible()
  await page.getByRole("button", { name: "More" }).click()
  expect(clicks).toBe(2)
  await expect.element(page.getByText("rows")).toBeVisible()
})
