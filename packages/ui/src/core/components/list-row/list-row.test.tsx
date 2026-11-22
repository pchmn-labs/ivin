import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { IconButton } from "../button/button.tsx"
import { Menu } from "../menu/menu.tsx"
import { ListRow } from "./list-row.tsx"

test("a row's subtitle sits on its own line under the title, and both are one button", async () => {
  await render(<ListRow title="Fix the cart" subtitle="shop" meta="3 min" />)
  const button = page.getByRole("button", { name: "Fix the cart shop 3 min" })
  await expect.element(button).toBeVisible()

  const title = page.getByText("Fix the cart").element().getBoundingClientRect()
  const subtitle = page.getByText("shop").element().getBoundingClientRect()
  expect(subtitle.top).toBeGreaterThanOrEqual(title.bottom)
  expect(subtitle.left).toBe(title.left)
})

test("controls below a row sit in its frame, outside its button", async () => {
  const opened: string[] = []
  await render(
    <ListRow
      data-testid="row"
      title="Write the post"
      onSelect={() => opened.push("row")}
      below={<button type="button">Allow</button>}
    />,
  )

  const row = page.getByTestId("row").element().getBoundingClientRect()
  const allow = page.getByRole("button", { name: "Allow" }).element().getBoundingClientRect()
  expect(allow.bottom).toBeLessThanOrEqual(row.bottom)
  expect(allow.top).toBeGreaterThan(
    page.getByText("Write the post").element().getBoundingClientRect().bottom,
  )
  await page.getByRole("button", { name: "Allow" }).click()
  expect(opened).toEqual([])
})

test("a row's tooltip shows its text, under its label, after a hover", async () => {
  await render(
    <ListRow
      data-testid="row"
      title="Rotate the certificates"
      tooltip={{
        text: "kubectl apply -f certs/staging.yaml",
        label: "Approval needed",
        mono: true,
      }}
    />,
  )

  await page.getByTestId("row").hover()
  const tooltip = page.getByText("kubectl apply -f certs/staging.yaml")
  await expect.element(tooltip).toBeVisible()
  await expect.element(page.getByText("Approval needed")).toBeVisible()
})

test("a row keeps its actions button shown while the pointer is on the menu it opened", async () => {
  await render(
    <ListRow
      data-testid="row"
      title="Fix the cart"
      actions={
        <Menu
          trigger={<IconButton icon="ellipsis" label="Session actions" size="sm" />}
          items={[{ label: "Archive", onSelect: () => {} }]}
        />
      }
    />,
  )

  await page.getByTestId("row").hover()
  await page.getByRole("button", { name: "Session actions" }).click()
  await page.getByRole("menuitem", { name: "Archive" }).hover()

  await expect.element(page.getByRole("button", { name: "Session actions" })).toBeVisible()
})
