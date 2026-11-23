import { RegistryProvider } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

const base = { sessionId: "s1", at: 0 }
const review = { taskId: "k1", kind: "agent", description: "Review the diff" } as const
const tests = { taskId: "k2", kind: "command", description: "End-to-end tests" } as const

const task = (
  position: number,
  { taskId, kind, description }: typeof review | typeof tests,
): TranscriptItem => ({
  ...base,
  id: `task-${taskId}`,
  position,
  type: "task",
  taskId,
  toolCallId: `call-${taskId}`,
  kind,
  description,
  status: "running",
  summary: null,
  output: null,
})

const step = (position: number, item: Record<string, unknown>): TranscriptItem =>
  ({
    ...base,
    id: `step-${position}`,
    position,
    parentToolCallId: "call-k1",
    ...item,
  }) as TranscriptItem

const items: TranscriptItem[] = [
  {
    ...base,
    id: "m0",
    position: 0,
    type: "message",
    role: "user",
    text: "Run the review and the tests",
    images: [],
    steer: false,
  },
  {
    ...base,
    id: "m1",
    position: 1,
    type: "message",
    role: "assistant",
    text: "Both run in the background.",
    images: [],
    steer: false,
  },
  task(2, review),
  task(3, tests),
  step(4, {
    type: "message",
    role: "assistant",
    text: "I read the session runner first.",
    images: [],
    steer: false,
  }),
  step(5, {
    type: "tool_call",
    toolCallId: "sub-1",
    name: "Read",
    kind: "read",
    input: { file_path: "apps/server/src/session-runs.ts" },
    status: "done",
    output: "export const setStatus",
  }),
]

const mountSession = async (overrides: Partial<Session> = {}) => {
  const server = makeFakeServer()
  server.openProject("/p")
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Fix the double stop",
      projectPath: "/p",
      started: true,
      status: "in_background",
      backgroundTasks: [review, tests],
      ...overrides,
    }),
  )
  server.seedItems("s1", items)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          <SessionView projectPath="/p" sessionId="s1" />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

const line = () => page.getByTestId("background-line")

test("a session in background folds its tasks under the last turn, and its steps stay out of the turns", async () => {
  await mountSession()

  await expect.element(line()).toHaveTextContent("2 tasks in background")
  expect(page.getByText("Review the diff").query()).toBeNull()
  expect(page.getByText("I read the session runner first.").query()).toBeNull()

  await line().click()

  await expect.element(page.getByText("Review the diff")).toBeVisible()
  await expect.element(page.getByText("End-to-end tests")).toBeVisible()
  await expect.element(page.getByText("Both run in the background.")).toBeVisible()
})

test("the fold stays while the agent works again with tasks running, and goes with the last task", async () => {
  const server = await mountSession()
  await expect.element(line()).toBeVisible()

  server.setStatus("s1", "working")
  server.setBackgroundTasks("s1", [tests])

  await expect.element(line()).toHaveTextContent("1 task in background")
  server.setBackgroundTasks("s1", [])
  await expect.poll(() => page.getByTestId("background-line").query()).toBeNull()
})

test("a task's row unfolds on its last steps without opening the sheet", async () => {
  await mountSession()
  await line().click()

  await page.getByText("Review the diff").click()

  await expect.element(page.getByText("I read the session runner first.")).toBeVisible()
  expect(page.getByTestId("task-sheet").query()).toBeNull()
})

test("a subagent's details open in a sheet with its whole run, followed live", async () => {
  const server = await mountSession()
  await line().click()

  await page.getByTestId("task-details").first().click()

  const sheet = page.getByTestId("task-sheet")
  await expect.element(sheet).toBeVisible()
  await expect
    .poll(() => sheet.getByTestId("task-run").element().textContent)
    .toContain("Working for")
  await expect.element(sheet.getByText("I read the session runner first.")).toBeVisible()
  await expect.element(sheet.getByText("apps/server/src/session-runs.ts")).toBeVisible()

  server.pushItem(
    step(6, {
      type: "message",
      role: "assistant",
      text: "Found it: the stop path reads the list before the lock.",
      images: [],
      steer: false,
    }),
  )

  await expect
    .element(sheet.getByText("Found it: the stop path reads the list before the lock."))
    .toBeVisible()
})

test("the sheet's tabs switch between tasks, and a command's output follows live", async () => {
  const server = await mountSession()
  await line().click()
  await page.getByTestId("task-details").first().click()
  const sheet = page.getByTestId("task-sheet")

  await sheet.getByRole("tab", { name: "End-to-end tests" }).click()

  await expect.element(sheet.getByText("No output yet")).toBeVisible()
  server.taskOutputs.set("s1/k2", "shard 2/3 started\n")
  const output = sheet.getByTestId("task-output")
  // The command is read once a second.
  await expect
    .poll(() => output.element().textContent, { timeout: 5000 })
    .toContain("shard 2/3 started")
  server.taskOutputs.set("s1/k2", "shard 2/3 started\n12 passed\n")
  await expect.poll(() => output.element().textContent, { timeout: 5000 }).toContain("12 passed")
})

test("Escape, the close button and a click outside close the sheet", async () => {
  await mountSession()
  await line().click()
  const open = async () => {
    await page.getByTestId("task-details").first().click()
    await expect.element(page.getByTestId("task-sheet")).toBeVisible()
  }

  await open()
  await userEvent.keyboard("{Escape}")
  await expect.poll(() => page.getByTestId("task-sheet").query()).toBeNull()

  await open()
  await page.getByRole("button", { name: "Close the task" }).click()
  await expect.poll(() => page.getByTestId("task-sheet").query()).toBeNull()

  await open()
  await page.getByText("Run the review and the tests").click()
  await expect.poll(() => page.getByTestId("task-sheet").query()).toBeNull()
})

test("the tabs list the tasks that run, and a task that ended while shown", async () => {
  await mountSession()
  await line().click()
  await page.getByTestId("task-details").first().click()

  const tabs = page.getByRole("tab")
  await expect.element(tabs.nth(0)).toHaveTextContent("Review the diff")
  await expect.element(tabs.nth(1)).toHaveTextContent("End-to-end tests")
})
