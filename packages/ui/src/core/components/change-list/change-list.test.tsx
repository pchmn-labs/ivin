import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ChangeList, type ChangeGroup, type ChangeListItem } from "./change-list.tsx"

const item = (
  id: string,
  status: ChangeListItem["status"],
  added: number | null = 1,
  deleted: number | null = 0,
): ChangeListItem => {
  const slash = id.lastIndexOf("/")
  return {
    id,
    name: id.slice(slash + 1),
    folder: slash < 0 ? "" : id.slice(0, slash),
    status,
    added,
    deleted,
  }
}

const groups = (actions: {
  onDiscard?: (id: string) => void
  onDiscardAll?: () => void
}): ReadonlyArray<ChangeGroup> => [
  {
    id: "uncommitted",
    heading: "Uncommitted",
    label: "Uncommitted changes",
    items: [item("a.ts", "modified", 2, 1), item("notes.md", "untracked", null, null)],
    ...(actions.onDiscard && { onDiscard: actions.onDiscard }),
    ...(actions.onDiscardAll && {
      discardAll: { label: "Discard all uncommitted changes", onDiscard: actions.onDiscardAll },
    }),
  },
  {
    id: "committed",
    heading: "Committed",
    label: "Committed changes",
    items: [item("src/b.ts", "deleted", 0, 4)],
  },
]

const mount = (props: Partial<Parameters<typeof ChangeList>[0]> = {}) =>
  render(
    <RegistryProvider>
      <ChangeList
        label="Changes"
        groups={groups({})}
        selected={null}
        onOpen={() => {}}
        {...props}
      />
    </RegistryProvider>,
  )

const row = (name: string) =>
  page.getByRole("button", {
    name: new RegExp(`^(modified|added|deleted|renamed|untracked) ${name}`),
  })
const heading = (name: string) => page.getByRole("button", { name: new RegExp(`^${name} \\d`) })

test("one tab stop moves through the headings and rows of every group, and Enter opens a row", async () => {
  const onOpen = vi.fn()
  await mount({ onOpen, selected: { groupId: "committed", id: "src/b.ts" } })
  await userEvent.keyboard("{Tab}")
  await expect.element(row("b.ts")).toHaveFocus()
  await userEvent.keyboard("{ArrowUp}")
  await expect.element(heading("Committed")).toHaveFocus()
  await userEvent.keyboard("{ArrowUp}")
  await expect.element(row("notes.md")).toHaveFocus()
  await userEvent.keyboard("{Home}{ArrowDown}{Enter}")
  expect(onOpen).toHaveBeenCalledWith("uncommitted", "a.ts")
})

test("Left folds a heading, or goes from a row to its heading, and Right unfolds it", async () => {
  await mount()
  await userEvent.keyboard("{Tab}{ArrowDown}{ArrowLeft}")
  await expect.element(heading("Uncommitted")).toHaveFocus()
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(heading("Uncommitted")).toHaveAttribute("aria-expanded", "false")
  await expect.element(row("a.ts")).not.toBeInTheDocument()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(heading("Committed")).toHaveFocus()
  await userEvent.keyboard("{ArrowUp}{ArrowRight}")
  await expect.element(row("a.ts")).toBeVisible()
})

test("Backspace discards the row, ⌘Backspace them all, and only a group that can discard offers it", async () => {
  const onDiscard = vi.fn()
  const onDiscardAll = vi.fn()
  await mount({ groups: groups({ onDiscard, onDiscardAll }) })
  await userEvent.keyboard("{Tab}{ArrowDown}{Backspace}")
  expect(onDiscard).toHaveBeenCalledWith("a.ts")
  await userEvent.keyboard("{Meta>}{Backspace}{/Meta}")
  expect(onDiscardAll).toHaveBeenCalledOnce()
  await expect
    .element(page.getByRole("button", { name: "Discard all uncommitted changes" }))
    .toBeVisible()
  await row("b.ts").hover()
  await expect
    .element(page.getByRole("button", { name: "Discard the changes to b.ts" }))
    .not.toBeInTheDocument()
  await userEvent.keyboard("{End}{Backspace}")
  expect(onDiscard).toHaveBeenCalledOnce()
})

test("each row shows its status letter, name, folder and counts", async () => {
  await mount()
  await expect.element(row("a.ts")).toHaveTextContent("Mmodifieda.ts+2−1")
  await expect.element(row("b.ts")).toHaveTextContent("Ddeletedb.tssrc−4")
  await expect.element(heading("Uncommitted")).toHaveTextContent("Uncommitted 2")
})
