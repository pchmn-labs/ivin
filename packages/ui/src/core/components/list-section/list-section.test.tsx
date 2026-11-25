import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ListSection } from "./list-section.tsx"

test("a list section is a region named by its label, with its count and its rows", async () => {
  await render(
    <ListSection label="Needs you" count={2} attention>
      <li>First</li>
      <li>Second</li>
    </ListSection>,
  )
  const section = page.getByRole("region", { name: "Needs you" })

  await expect.element(section.getByRole("heading", { name: "Needs you 2" })).toBeVisible()
  expect(section.getByRole("listitem").all()).toHaveLength(2)
})

test("a list section without a count shows only its label", async () => {
  await render(
    <ListSection label="Running">
      <li>Row</li>
    </ListSection>,
  )

  await expect.element(page.getByRole("heading", { name: "Running", exact: true })).toBeVisible()
})

test("a list section with a hidden label is still a region named by it", async () => {
  await render(
    <ListSection label="Needs you" count={1} attention hideLabel>
      <li>Row</li>
    </ListSection>,
  )
  const heading = page
    .getByRole("region", { name: "Needs you" })
    .getByRole("heading", { name: "Needs you 1" })

  await expect.element(heading).toBeInTheDocument()
})
