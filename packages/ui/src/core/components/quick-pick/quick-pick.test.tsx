import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { QuickPickItem } from "@ivin/plugin-api/ui"
import { QuickPick } from "./quick-pick.tsx"

const items: ReadonlyArray<QuickPickItem> = [
  { id: "src/config.ts", label: "config.ts", detail: "src", match: [0, 1] },
  { id: "vite.config.ts", label: "vite.config.ts", status: "modified" },
  { id: "README.md", label: "README.md" },
]

function Harness({ onPick, message }: { onPick: (id: string) => void; message?: string }) {
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState("")
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <QuickPick
        open={open}
        onOpenChange={setOpen}
        label="Go to file"
        placeholder="Go to a file"
        query={query}
        onQueryChange={setQuery}
        items={query === "zz" ? [] : items}
        onPick={onPick}
        footer="3 files"
        {...(message !== undefined && { message })}
      />
    </>
  )
}

const field = () => page.getByRole("combobox", { name: "Go to file" })
const option = (name: string) => page.getByRole("option", { name })

test("opens with the focus in its field and the first choice highlighted", async () => {
  await render(<Harness onPick={() => undefined} />)
  await expect.element(field()).toHaveFocus()
  await expect.element(option("config.ts src")).toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByText("3 files")).toBeVisible()
})

test("Up and Down move the highlight, and Enter picks it", async () => {
  const onPick = vi.fn()
  await render(<Harness onPick={onPick} />)
  await expect.element(field()).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}")
  await expect.element(option("vite.config.ts")).toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard("{Enter}")
  expect(onPick).toHaveBeenCalledWith("vite.config.ts")
})

test("a click picks a choice", async () => {
  const onPick = vi.fn()
  await render(<Harness onPick={onPick} />)
  await option("README.md").click()
  expect(onPick).toHaveBeenCalledWith("README.md")
})

test("typing goes to the field; the highlight goes back to the first choice", async () => {
  await render(<Harness onPick={() => undefined} />)
  await expect.element(field()).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}c")
  await expect.element(field()).toHaveValue("c")
  await expect.element(option("config.ts src")).toHaveAttribute("aria-selected", "true")
})

test("Escape closes it and gives the focus back", async () => {
  await render(<Harness onPick={() => undefined} />)
  await expect.element(field()).toHaveFocus()
  await userEvent.keyboard("{Escape}")
  await expect.element(field()).not.toBeInTheDocument()
})

test("a message takes the list's place", async () => {
  await render(<Harness onPick={() => undefined} message="No file matches “zz”." />)
  await expect.element(page.getByText("No file matches “zz”.")).toBeVisible()
  await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
})
