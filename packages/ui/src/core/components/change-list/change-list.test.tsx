import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ChangeList, type ChangeListItem } from "./change-list.tsx"

const items: ReadonlyArray<ChangeListItem> = [
  { id: "a.ts", name: "a.ts", folder: "", status: "modified", added: 2, deleted: 1 },
  { id: "src/b.ts", name: "b.ts", folder: "src", status: "deleted", added: 0, deleted: 4 },
  { id: "c.ts", name: "c.ts", folder: "", status: "untracked", added: null, deleted: null },
]

const row = (name: string) =>
  page.getByRole("button", {
    name: new RegExp(`^(modified|added|deleted|renamed|untracked) ${name}`),
  })

test("one row is a tab stop; Up and Down move between rows and Enter opens one", async () => {
  const onOpen = vi.fn()
  await render(<ChangeList label="Changes" items={items} selectedId="src/b.ts" onOpen={onOpen} />)
  await userEvent.keyboard("{Tab}")
  await expect.element(row("b.ts")).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(row("c.ts")).toHaveFocus()
  await userEvent.keyboard("{Home}{Enter}")
  expect(onOpen).toHaveBeenCalledWith("a.ts")
})

test("each row shows its status, name, folder and counts, and a deleted file has no Open file", async () => {
  const onOpenFile = vi.fn()
  await render(
    <ChangeList
      label="Changes"
      items={items}
      selectedId={null}
      onOpen={() => {}}
      onOpenFile={onOpenFile}
    />,
  )
  await expect.element(row("a.ts")).toHaveTextContent("Mmodifieda.ts+2−1")
  await expect.element(row("b.ts")).toHaveTextContent("Ddeletedb.tssrc−4")
  await row("a.ts").hover()
  await page.getByRole("button", { name: "Open a.ts" }).click()
  expect(onOpenFile).toHaveBeenCalledWith("a.ts")
  await row("b.ts").hover()
  await expect.element(page.getByRole("button", { name: "Open b.ts" })).not.toBeInTheDocument()
})
