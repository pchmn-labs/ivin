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

test("a session in background shows its own status mark and says so", async () => {
  await render(<SessionMark status="in_background" harness="claude" tasks={tasks} />)

  await expect.element(page.getByText("In background")).toBeInTheDocument()
  expect(document.querySelector(".iv-session-mark")?.getAttribute("data-status")).toBe(
    "in_background",
  )
})

test("hovering the mark of a session in background lists its tasks", async () => {
  await render(<SessionMark status="in_background" harness="claude" tasks={tasks} />)

  await page.elementLocator(document.querySelector(".iv-session-mark")!).hover()

  await expect.element(page.getByText("2 tasks in background")).toBeInTheDocument()
  await expect.element(page.getByText("Review the diff")).toBeInTheDocument()
  await expect.element(page.getByText("Dev server")).toBeInTheDocument()
})
