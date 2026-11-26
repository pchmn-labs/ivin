import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ColumnMenu, type ColumnMenuColumn } from "./column-menu.tsx"

const item = (value: string, extra: { disabled?: boolean; description?: string } = {}) => ({
  value,
  label: value,
  checked: false,
  ...extra,
})

const columns: ColumnMenuColumn[] = [
  {
    key: "fruit",
    label: "Fruit",
    sections: [
      { items: [item("apple", { description: "Crunchy" }), { ...item("pear"), checked: true }] },
      { label: "Dried", items: [item("fig"), item("date")] },
    ],
  },
  {
    key: "size",
    label: "Size",
    sections: [{ items: [item("small"), item("medium", { disabled: true }), item("large")] }],
  },
  { key: "none", label: "None", sections: [{ items: [item("gone", { disabled: true })] }] },
]

const setup = async (startColumn?: string) => {
  const onPick = vi.fn()
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <div style={{ paddingTop: 400, paddingLeft: 24 }}>
        <ColumnMenu
          label="Basket"
          open={open}
          onOpenChange={setOpen}
          columns={columns}
          onPick={onPick}
          hint="Pick what goes in"
          {...(startColumn !== undefined && { startColumn })}
          trigger={<button type="button">Basket</button>}
        />
      </div>
    )
  }
  await render(<Harness />)
  return { onPick }
}

const highlighted = () =>
  document.querySelector('[role="option"][data-highlighted] .iv-column-menu__label')?.textContent

test("the menu opens above its button with one listbox per column, on the current value", async () => {
  await setup()
  await page.getByRole("button", { name: "Basket" }).click()

  await expect.element(page.getByRole("listbox", { name: "Fruit" })).toBeVisible()
  await expect.element(page.getByRole("listbox", { name: "Size" })).toBeVisible()
  expect(highlighted()).toBe("pear")
  const popup = document.querySelector(".iv-column-menu")!.getBoundingClientRect()
  const button = page.getByRole("button", { name: "Basket" }).element().getBoundingClientRect()
  expect(popup.bottom).toBeLessThanOrEqual(button.top)
})

test("up and down move through a column's sections, left and right between columns on the same row", async () => {
  await setup()
  await page.getByRole("button", { name: "Basket" }).click()

  await userEvent.keyboard("{ArrowDown}")
  expect(highlighted()).toBe("fig")
  await userEvent.keyboard("{ArrowRight}")
  expect(highlighted()).toBe("large")
  await userEvent.keyboard("{ArrowUp}")
  expect(highlighted()).toBe("small")
  await userEvent.keyboard("{ArrowRight}")
  expect(highlighted()).toBe("apple")
  await userEvent.keyboard("{End}")
  expect(highlighted()).toBe("date")
})

test("a disabled item is skipped by the keyboard and cannot be picked", async () => {
  const { onPick } = await setup("size")
  await page.getByRole("button", { name: "Basket" }).click()

  expect(highlighted()).toBe("small")
  await userEvent.keyboard("{ArrowDown}")
  expect(highlighted()).toBe("large")
  ;(page.getByRole("option", { name: "medium" }).element() as HTMLElement).click()
  expect(onPick).not.toHaveBeenCalled()
})

test("picking keeps the menu open and names the column", async () => {
  const { onPick } = await setup()
  await page.getByRole("button", { name: "Basket" }).click()

  await userEvent.keyboard("{ArrowUp}{Enter}")
  expect(onPick).toHaveBeenCalledWith("fruit", "apple")
  await page.getByRole("option", { name: "large" }).click()
  expect(onPick).toHaveBeenLastCalledWith("size", "large")
  await expect.element(page.getByRole("listbox", { name: "Fruit" })).toBeVisible()
})

test("an item's description shows under its label, and the footer keeps the hint", async () => {
  await setup()
  await page.getByRole("button", { name: "Basket" }).click()
  const foot = () => document.querySelector(".iv-column-menu__hint")?.textContent

  const apple = page.getByRole("option", { name: "apple" })
  await expect.element(apple).toHaveAccessibleDescription("Crunchy")
  await expect.element(apple.getByText("Crunchy")).toBeVisible()
  await userEvent.keyboard("{ArrowUp}")
  expect(foot()).toBe("Pick what goes in")
})
