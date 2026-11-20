import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ContextMenu, Menu } from "./menu.tsx"

const setup = async () => {
  const onRename = vi.fn()
  const onArchive = vi.fn()
  const onDelete = vi.fn()
  await render(
    <Menu
      trigger={<button type="button">Actions</button>}
      items={[
        { label: "Rename", onSelect: onRename },
        { label: "Archive", onSelect: onArchive, disabled: true },
        "separator",
        { label: "Delete", onSelect: onDelete, danger: true },
      ]}
    />,
  )
  return { onRename, onArchive, onDelete }
}

const trigger = () => page.getByRole("button", { name: "Actions" })
const highlighted = () => document.querySelector('[role="menuitem"][data-highlighted]')?.textContent

test("the keyboard opens the menu and arrows move the highlight", async () => {
  await setup()
  trigger().element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByRole("menu")).toBeVisible()
  await vi.waitFor(() => expect(highlighted()).toBe("Rename"))
  await userEvent.keyboard("{ArrowDown}")
  await vi.waitFor(() => expect(highlighted()).toBe("Archive"))
  await userEvent.keyboard("{ArrowDown}")
  await vi.waitFor(() => expect(highlighted()).toBe("Delete"))
  await userEvent.keyboard("{ArrowUp}")
  await vi.waitFor(() => expect(highlighted()).toBe("Archive"))
})

test("Enter on the highlighted item calls its onSelect and closes the menu", async () => {
  const { onRename } = await setup()
  trigger().element().focus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(page.getByRole("menu")).toBeVisible()
  await vi.waitFor(() => expect(highlighted()).toBe("Rename"))
  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(onRename).toHaveBeenCalledOnce())
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
})

test("a disabled item cannot be selected", async () => {
  const { onArchive } = await setup()
  await trigger().click()
  await page.getByRole("menuitem", { name: "Archive" }).click({ force: true })
  expect(onArchive).not.toHaveBeenCalled()
  await expect.element(page.getByRole("menu")).toBeVisible()
})

test("Escape closes the menu and returns focus to the trigger", async () => {
  await setup()
  await trigger().click()
  await expect.element(page.getByRole("menu")).toBeVisible()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger().element()))
})

test("checked items are one choice with a check on the chosen one, under their heading and with their hint", async () => {
  const onPick = vi.fn()
  await render(
    <Menu
      trigger={<button type="button">Folder</button>}
      items={[
        { label: "Checkout", onSelect: onPick, checked: true },
        "separator",
        { heading: "Worktrees" },
        { label: "docs/adr", onSelect: onPick, checked: false, hint: "Write the ADR" },
      ]}
    />,
  )
  await page.getByRole("button", { name: "Folder" }).click()

  await expect.element(page.getByText("Worktrees", { exact: true })).toBeVisible()
  const chosen = page.getByRole("menuitemradio", { name: "Checkout" })
  await expect.element(chosen).toHaveAttribute("aria-checked", "true")
  const other = page.getByRole("menuitemradio", { name: /docs\/adr/ })
  expect(other.element().textContent).toBe("docs/adrWrite the ADR")
  await other.click()
  expect(onPick).toHaveBeenCalledOnce()
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
})

test("a context menu opens on a right click and runs the chosen item", async () => {
  const onArchive = vi.fn()
  await render(
    <ContextMenu items={[{ label: "Archive", onSelect: onArchive }]}>
      <div>Tab</div>
    </ContextMenu>,
  )
  await page.getByText("Tab").click({ button: "right" })
  await page.getByRole("menuitem", { name: "Archive" }).click()
  expect(onArchive).toHaveBeenCalledOnce()
})
