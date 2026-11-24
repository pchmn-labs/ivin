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

const tasks = [
  {
    taskId: "k1",
    kind: "agent",
    description: "Review the diff",
    itemId: "i-k1",
    toolCallId: "t-k1",
    at: 0,
  },
  {
    taskId: "k2",
    kind: "command",
    description: "Dev server",
    itemId: "i-k2",
    toolCallId: "t-k2",
    at: 0,
  },
] as const

test("a session in background shows a pulsing dot, apart from the working spinner, and says so", async () => {
  await render(<SessionMark status="in_background" harness="claude" tasks={tasks} />)

  await expect.element(page.getByText("In background")).toBeInTheDocument()
  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-status")).toBe(
    "in_background",
  )
  const overlay = document.querySelector(".iv-session-mark__overlay")!
  const style = getComputedStyle(overlay)
  expect(style.animationName).toBe("iv-background-pulse")
  expect(style.borderTopWidth).toBe("0px")
})

test("hovering the mark of a session in background lists its tasks", async () => {
  await render(<SessionMark status="in_background" harness="claude" tasks={tasks} />)

  await page.elementLocator(document.querySelector(".iv-session-mark")!).hover()

  await expect.element(page.getByText("2 tasks in background")).toBeInTheDocument()
  await expect.element(page.getByText("Review the diff")).toBeInTheDocument()
  await expect.element(page.getByText("Dev server")).toBeInTheDocument()
})
