import { RegistryProvider } from "@effect/atom-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
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

const line = () => page.getByTestId("background-line")

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
