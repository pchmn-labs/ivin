import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Tabs } from "./tabs.tsx"

const tabs = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
]

const setup = async () => {
  const onValueChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState("a")
    return (
      <Tabs
        aria-label="Sections"
        tabs={tabs}
        value={value}
        onValueChange={(next) => {
          onValueChange(next)
          setValue(next)
        }}
      />
    )
  }
  await render(<Harness />)
  return onValueChange
}

const tab = (name: string) => page.getByRole("tab", { name })

test("clicking a tab selects it and reports the change", async () => {
  const onValueChange = await setup()
  await expect.element(tab("Alpha")).toHaveAttribute("aria-selected", "true")
  await tab("Beta").click()
  await expect.element(tab("Beta")).toHaveAttribute("aria-selected", "true")
  await expect.element(tab("Alpha")).toHaveAttribute("aria-selected", "false")
  expect(onValueChange).toHaveBeenLastCalledWith("b")
})

test("ArrowRight and ArrowLeft move the selection", async () => {
  const onValueChange = await setup()
  tab("Alpha").element().focus()
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(tab("Beta")).toHaveAttribute("aria-selected", "true")
  expect(onValueChange).toHaveBeenLastCalledWith("b")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(tab("Alpha")).toHaveAttribute("aria-selected", "true")
  expect(onValueChange).toHaveBeenLastCalledWith("a")
})
