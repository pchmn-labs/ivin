import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Dialog } from "./dialog.tsx"

const Harness = ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          setOpen(next)
        }}
        title="Rename"
        actions={<button type="button">Save</button>}
      >
        <input aria-label="Name" />
      </Dialog>
    </>
  )
}

const setup = async () => {
  const onOpenChange = vi.fn()
  await render(<Harness onOpenChange={onOpenChange} />)
  await page.getByRole("button", { name: "Open" }).click()
  await expect.element(page.getByRole("dialog", { name: "Rename" })).toBeVisible()
  return onOpenChange
}

test("Escape closes the dialog and returns focus to the opener", async () => {
  const onOpenChange = await setup()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  expect(onOpenChange).toHaveBeenLastCalledWith(false)
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Open" }).element()),
  )
})
