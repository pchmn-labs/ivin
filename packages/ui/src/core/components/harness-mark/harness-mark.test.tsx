import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { ClaudeMark, HarnessMark } from "./harness-mark.tsx"

test("the Claude mark is a decorative svg of the requested size", async () => {
  const { container } = await render(<ClaudeMark size={14} />)
  await expect.poll(() => container.querySelector("svg")).not.toBeNull()
  const svg = container.querySelector("svg")!
  expect(svg.getAttribute("aria-hidden")).toBe("true")
  expect(svg.getAttribute("width")).toBe("14")
})

test("a harness with no mark of its own draws the neutral agent mark", async () => {
  const { container } = await render(<HarnessMark mark="agent" />)
  await expect.poll(() => container.querySelector(".iv-harness-mark--agent")).not.toBeNull()
  expect(container.querySelector(".iv-harness-mark--claude")).toBeNull()
})
