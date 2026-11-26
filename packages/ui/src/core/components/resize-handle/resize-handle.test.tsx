import { afterEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ResizeHandle } from "./resize-handle.tsx"
import "./resize-handle.test.css"

afterEach(() => localStorage.clear())

function Panel() {
  return (
    <div className="test-resizable" data-testid="panel">
      <ResizeHandle
        label="Resize the panel"
        edge="right"
        property="--test-width"
        name="test-panel"
        min={200}
        max={() => 240}
      />
    </div>
  )
}

const width = () => page.getByTestId("panel").element().getBoundingClientRect().width

test("arrow keys resize within the bounds, and the size is kept for the next launch", async () => {
  const first = await render(<Panel />)
  await expect.element(page.getByTestId("panel")).toBeVisible()
  expect(width()).toBe(200)

  const handle = page.getByRole("separator", { name: "Resize the panel" })
  await expect.element(handle).toBeVisible()
  ;(handle.element() as HTMLElement).focus()
  await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
  await expect.poll(width).toBe(240)
  await first.unmount()

  await render(<Panel />)
  await expect.poll(width).toBe(240)
})

test("a double-click goes back to the stylesheet's size", async () => {
  localStorage.setItem("ivin.size.test-panel", "232")
  await render(<Panel />)
  await expect.poll(width).toBe(232)

  await page.getByRole("separator", { name: "Resize the panel" }).dblClick()
  await expect.poll(width).toBe(200)
})
