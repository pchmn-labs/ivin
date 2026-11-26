import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { SessionMark } from "./session-mark.tsx"

test.each([
  ["question", "Waiting for your answer"],
  ["approval", "Waiting for you"],
] as const)("a session waiting on a %s says what it waits for", async (waitingFor, label) => {
  await render(<SessionMark status="waiting" waitingFor={waitingFor} harness="claude" />)
  await expect.element(page.getByText(label)).toBeInTheDocument()
  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-waiting-for")).toBe(
    waitingFor,
  )
})
