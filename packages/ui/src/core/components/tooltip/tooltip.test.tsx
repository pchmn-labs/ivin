import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Tooltip } from "./tooltip.tsx"

const longText = Array.from({ length: 10 }, (_, i) => `line ${i + 1} ${"word ".repeat(20)}`).join(
  "\n",
)

async function shownLines(mono: boolean) {
  await render(
    <Tooltip content={longText} mono={mono}>
      <button type="button">Trigger</button>
    </Tooltip>,
  )
  await page.getByRole("button", { name: "Trigger" }).hover()
  await expect.element(page.getByText("line 1", { exact: false })).toBeVisible()
  const content = document.querySelector(".iv-tooltip__content")!
  return Math.round(content.clientHeight / Number.parseFloat(getComputedStyle(content).lineHeight))
}

test("a tooltip's text stops at three lines", async () => {
  expect(await shownLines(false)).toBe(3)
})

test("a mono tooltip's text stops at six lines", async () => {
  expect(await shownLines(true)).toBe(6)
})
