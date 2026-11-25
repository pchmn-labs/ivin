import { RegistryProvider } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { NotificationProvider } from "../../../core/components/notification/notification.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

const base = { sessionId: "s1", at: 0 }
const listed = (taskId: string, kind: "agent" | "command", description: string) =>
  ({
    taskId,
    kind,
    description,
    itemId: `task-${taskId}`,
    toolCallId: `call-${taskId}`,
    at: 0,
  }) as const
const review = listed("k1", "agent", "Review the diff")
const tests = listed("k2", "command", "End-to-end tests")

const task = (position: number, { taskId, kind, description }: typeof review): TranscriptItem => ({
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
        <NotificationProvider>
          <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <SessionView projectPath="/p" sessionId="s1" />
          </div>
        </NotificationProvider>
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

test("a task started before the loaded page of the transcript still shows in the fold and opens in the sheet", async () => {
  const later = Array.from({ length: 80 }, (_, i): TranscriptItem => ({
    ...base,
    id: `later-${i}`,
    position: 10 + i,
    type: "message",
    role: "assistant",
    text: `later ${i}`,
    images: [],
    steer: false,
  }))
  const server = makeFakeServer()
  server.openProject("/p")
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Run the tests",
      projectPath: "/p",
      started: true,
      status: "in_background",
      backgroundTasks: [tests],
    }),
  )
  server.seedItems("s1", [...items, ...later])
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          <SessionView projectPath="/p" sessionId="s1" />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("later 79", { exact: true })).toBeInTheDocument()
  await line().click()

  await expect.element(page.getByText("End-to-end tests")).toBeVisible()
  await page.getByTestId("task-details").click()
  await expect.element(page.getByTestId("view-sheet")).toBeVisible()
})

test("a task's Stop button asks the server to stop that task and does not unfold the row", async () => {
  const server = await mountSession()
  await line().click()

  await page.getByTestId("task-stop").first().click()

  await expect.poll(() => server.stoppedTasks).toEqual([expect.stringMatching(/^s1\//)])
  await expect.element(page.getByTestId("task-stopping")).toBeVisible()
  expect(page.getByTestId("view-sheet").query()).toBeNull()
  await expect
    .element(page.getByTestId("background-task").first().getByRole("button").first())
    .toHaveAttribute("aria-expanded", "false")
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
  expect(page.getByTestId("view-sheet").query()).toBeNull()
})
