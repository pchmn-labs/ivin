import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { SessionMark } from "./session-mark.tsx"

test("a session waiting on questions shows a question mark and says it waits for an answer", async () => {
  await render(<SessionMark status="waiting" waitingFor="question" harness="claude" />)
  await expect.element(page.getByText("Waiting for your answer")).toBeInTheDocument()
  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-waiting-for")).toBe(
    "question",
  )
})

test("a session waiting on an approval keeps the exclamation mark", async () => {
  await render(<SessionMark status="waiting" waitingFor="approval" harness="claude" />)
  await expect.element(page.getByText("Waiting for you")).toBeInTheDocument()
  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-waiting-for")).toBe(
    "approval",
  )
})
