import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { ClaudeMark } from "./harness-mark.tsx"

test("the Claude mark is a decorative eight-ray svg of the requested size", async () => {
  const { container } = await render(<ClaudeMark size={14} />)
  const svg = container.querySelector("svg")!
  expect(svg.getAttribute("aria-hidden")).toBe("true")
  expect(svg.getAttribute("width")).toBe("14")
  expect(svg.querySelectorAll("path")).toHaveLength(8)
})

test("the Claude mark is 16px by default", async () => {
  const { container } = await render(<ClaudeMark />)
  expect(container.querySelector("svg")!.getAttribute("height")).toBe("16")
})
