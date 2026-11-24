import { useState } from "react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Segmented } from "./segmented.tsx"

function Shown() {
  const [value, setValue] = useState<"image" | "source">("image")
  return (
    <>
      <Segmented
        label="Show"
        value={value}
        onChange={setValue}
        options={[
          { value: "image", label: "Image" },
          { value: "source", label: "Source" },
        ]}
      />
      <p>{value}</p>
    </>
  )
}

test("one option is pressed at a time, and pressing the pressed one keeps it", async () => {
  await render(<Shown />)
  const image = page.getByRole("button", { name: "Image" })
  const source = page.getByRole("button", { name: "Source" })
  await expect.element(image).toHaveAttribute("aria-pressed", "true")
  await source.click()
  await expect.element(page.getByText("source", { exact: true })).toBeVisible()
  await expect.element(image).toHaveAttribute("aria-pressed", "false")
  await source.click()
  await expect.element(source).toHaveAttribute("aria-pressed", "true")
  ;(image.element() as HTMLElement).focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByText("image", { exact: true })).toBeVisible()
})
