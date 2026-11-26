import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ReactNode } from "react"
import { ComposerMenu, type ComposerMenuItem } from "./composer-menu.tsx"

const itemsNamed = (names: ReadonlyArray<string>): ComposerMenuItem<string>[] =>
  names.map((name) => ({ value: name, key: name, label: name }))

const setup = async (names: ReadonlyArray<string>, topSpace = 600) => {
  const onPick = vi.fn()
  await render(
    <div style={{ paddingTop: topSpace, paddingLeft: 24 }}>
      <ComposerMenu
        label="Pick a fruit"
        searchPlaceholder="Find a fruit…"
        noMatch={(query) => `No fruit matches “${query}”.`}
        trigger={
          <button type="button" aria-label="Fruit">
            Fruit
          </button>
        }
        groups={[{ items: itemsNamed(names) }]}
        onPick={onPick}
      />
    </div>,
  )
  return { onPick }
}

const trigger = () => page.getByRole("combobox", { name: "Fruit" })
const popup = () => document.querySelector<HTMLElement>(".iv-composer-menu")
const highlighted = () => document.querySelector('[role="option"][data-highlighted]')?.textContent
const manyNames = Array.from({ length: 40 }, (_, i) => `fruit-${String(i).padStart(2, "0")}`)

test("the menu opens above its button, on the button's left edge", async () => {
  await setup(["apple", "pear"])
  await trigger().click()
  await expect.element(page.getByRole("option", { name: "apple" })).toBeVisible()

  await vi.waitFor(() => {
    const menu = popup()!.getBoundingClientRect()
    const button = trigger().element().getBoundingClientRect()
    expect(menu.bottom).toBeLessThanOrEqual(button.top)
    expect(Math.round(menu.left)).toBe(Math.round(button.left))
  })
})

test("a long list scrolls inside the menu, which stays at most 360px high", async () => {
  await setup(manyNames)
  await trigger().click()
  await expect.element(page.getByRole("option", { name: "fruit-00" })).toBeVisible()

  await vi.waitFor(() => expect(popup()!.getBoundingClientRect().height).toBeLessThanOrEqual(360))
  const list = document.querySelector<HTMLElement>(".iv-composer-menu__viewport")!
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
})

test("with little room above its button, the menu shrinks rather than open below", async () => {
  await setup(manyNames, 140)
  await trigger().click()
  await expect.element(page.getByRole("option", { name: "fruit-00" })).toBeInTheDocument()

  await vi.waitFor(() => {
    const menu = popup()!.getBoundingClientRect()
    expect(menu.bottom).toBeLessThanOrEqual(trigger().element().getBoundingClientRect().top)
    expect(menu.top).toBeGreaterThanOrEqual(0)
  })
})

test("a short list has no search field", async () => {
  await setup(["apple", "pear"])
  await trigger().click()
  await expect.element(page.getByRole("option", { name: "apple" })).toBeVisible()
  expect(page.getByPlaceholder("Find a fruit…").query()).toBeNull()
})

test("a list longer than the menu holds gets a search field, focused on open, that filters it", async () => {
  await setup(manyNames)
  await trigger().click()
  const search = page.getByRole("combobox", { name: "Pick a fruit" })
  await expect.element(search).toHaveFocus()
  await userEvent.keyboard("fruit-3")
  await expect.element(page.getByRole("option", { name: "fruit-31" })).toBeVisible()
  expect(page.getByRole("option", { name: "fruit-00" }).query()).toBeNull()
  await userEvent.keyboard("x")
  await expect.element(page.getByText("No fruit matches “fruit-3x”.")).toBeVisible()
})

test("keyboard only: open, move, pick, and focus returns to the button", async () => {
  const { onPick } = await setup(["apple", "pear", "plum"])
  await expect.element(trigger()).toBeVisible()
  trigger().element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByRole("option", { name: "apple" })).toBeVisible()
  await userEvent.keyboard("{ArrowDown}")
  await vi.waitFor(() => expect(highlighted()).toBe("apple"))
  await userEvent.keyboard("{ArrowDown}")
  await vi.waitFor(() => expect(highlighted()).toBe("pear"))
  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(onPick).toHaveBeenCalledWith("pear"))
  await expect.element(page.getByRole("option", { name: "apple" })).not.toBeInTheDocument()
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger().element()))
})

test("keyboard only in a long list: filter, move, pick", async () => {
  const { onPick } = await setup(manyNames)
  await expect.element(trigger()).toBeVisible()
  trigger().element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByRole("combobox", { name: "Pick a fruit" })).toHaveFocus()
  await userEvent.keyboard("fruit-1")
  await vi.waitFor(() => expect(highlighted()).toBe("fruit-10"))
  await userEvent.keyboard("{ArrowDown}{Enter}")
  await vi.waitFor(() => expect(onPick).toHaveBeenCalledWith("fruit-11"))
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger().element()))
})

test("Escape closes the menu and returns focus to the button", async () => {
  const { onPick } = await setup(manyNames)
  await trigger().click()
  await expect.element(page.getByRole("combobox", { name: "Pick a fruit" })).toHaveFocus()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("option", { name: "fruit-00" })).not.toBeInTheDocument()
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger().element()))
  expect(onPick).not.toHaveBeenCalled()
})

test("a label longer than the menu is cut with an ellipsis and shown in full on hover", async () => {
  const long = `feat/${"a-very-long-branch-name-".repeat(6)}end`
  await setup([long])
  await trigger().click()
  const label = page
    .getByRole("option")
    .element()
    .querySelector<HTMLElement>(".iv-composer-menu__label")!
  await vi.waitFor(() => expect(label.scrollWidth).toBeGreaterThan(label.clientWidth))
  expect(getComputedStyle(label).textOverflow).toBe("ellipsis")
  expect(label.title).toBe(long)
})

test("rows show their group heading, icon, tag, hint and the check on the chosen one", async () => {
  await render(
    <ComposerMenu
      label="Working folder"
      searchPlaceholder="Find a folder…"
      noMatch={() => ""}
      trigger={
        <button type="button" aria-label="Folder">
          Folder
        </button>
      }
      groups={[
        { items: [{ value: "checkout", key: "c", label: "Current checkout", checked: true }] },
        {
          label: "Existing worktrees",
          items: [
            { value: "wt", key: "w", label: "docs/adr", icon: "worktree", hint: "Write the ADR" },
            { value: "held", key: "h", label: "feat/x", tag: "in worktree", checked: false },
          ],
        },
      ]}
      onPick={() => {}}
    />,
  )
  await page.getByRole("combobox", { name: "Folder" }).click()

  await expect.element(page.getByText("Existing worktrees", { exact: true })).toBeVisible()
  const chosen = page.getByRole("option", { name: /Current checkout/ })
  await expect.element(chosen.getByLabelText("Chosen")).toBeInTheDocument()
  expect(page.getByRole("option", { name: /docs\/adr/ }).element().textContent).toBe(
    "docs/adrWrite the ADR",
  )
  await expect
    .element(page.getByRole("option", { name: /feat\/x/ }).getByText("in worktree"))
    .toBeVisible()
  expect(
    page
      .getByRole("option", { name: /feat\/x/ })
      .getByLabelText("Chosen")
      .query(),
  ).toBeNull()
})

const fruitMenu = (names: ReadonlyArray<string>, footer?: ReactNode) => (
  <ComposerMenu
    label="Pick a fruit"
    searchPlaceholder="Find a fruit…"
    noMatch={() => ""}
    trigger={
      <button type="button" aria-label="Fruit">
        Fruit
      </button>
    }
    groups={[{ items: itemsNamed(names) }]}
    onPick={() => {}}
  >
    {footer}
  </ComposerMenu>
)

test("a list with a footer gets its search field before it scrolls", async () => {
  await render(fruitMenu(manyNames.slice(0, 11), <div style={{ height: 29 }}>Footer</div>))
  await trigger().click()
  await expect.element(page.getByPlaceholder("Find a fruit…")).toBeVisible()
})

test("a list that grows past the limit while open gets a focused search field, which stays when it shrinks", async () => {
  const screen = await render(fruitMenu(["apple", "pear"]))
  await trigger().click()
  await expect.element(page.getByRole("option", { name: "apple" })).toBeVisible()
  expect(page.getByPlaceholder("Find a fruit…").query()).toBeNull()

  await screen.rerender(fruitMenu(manyNames))
  await expect.element(page.getByPlaceholder("Find a fruit…")).toHaveFocus()
  await userEvent.keyboard("fruit-0")
  await screen.rerender(fruitMenu(["fruit-01", "pear"]))
  await expect.element(page.getByPlaceholder("Find a fruit…")).toHaveValue("fruit-0")
})
