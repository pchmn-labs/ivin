import { useState } from "react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Chips } from "./chips.tsx"

function Shown() {
  const [value, setValue] = useState("all")
  return (
    <Chips
      label="Repository"
      value={value}
      onChange={setValue}
      options={[
        { value: "all", label: "All", count: 3 },
        { value: "api", label: "api", count: 2 },
      ]}
    />
  )
}

test("one chip is pressed at a time, and pressing the pressed one keeps it", async () => {
  await render(<Shown />)
  const all = page.getByRole("button", { name: "All 3" })
  const api = page.getByRole("button", { name: "api 2" })
  await expect.element(all).toHaveAttribute("aria-pressed", "true")
  await api.click()
  await expect.element(api).toHaveAttribute("aria-pressed", "true")
  await expect.element(all).toHaveAttribute("aria-pressed", "false")
  await api.click()
  await expect.element(api).toHaveAttribute("aria-pressed", "true")
})
