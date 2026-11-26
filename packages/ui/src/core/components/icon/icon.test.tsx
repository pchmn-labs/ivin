import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Icon } from "./icon.tsx"

test("an icon in the main chunk is one svg sized by size and coloured by currentColor", async () => {
  const { container } = await render(<Icon name="check" size={14} />)
  const svg = container.querySelector("svg")
  expect(svg?.getAttribute("width")).toBe("14")
  expect(svg?.getAttribute("height")).toBe("14")
  expect(svg?.getAttribute("fill")).toBe("currentColor")
  expect(svg?.getAttribute("viewBox")).toBe("0 0 256 256")
  expect(svg?.getAttribute("aria-hidden")).toBe("true")
  expect(svg?.querySelectorAll("path")).toHaveLength(1)
})

test("a label makes the icon an image with that name", async () => {
  await render(<Icon name="check" label="Done" />)
  await expect.element(page.getByRole("img", { name: "Done" })).toBeVisible()
})

test("an icon loaded on first use shows an empty slot of its size, then the glyph", async () => {
  const { container } = await render(<Icon name="lock" size={12} />)
  expect(container.querySelector("svg")?.getAttribute("width")).toBe("12")
  await expect.poll(() => container.querySelector("svg path")).not.toBeNull()
})
