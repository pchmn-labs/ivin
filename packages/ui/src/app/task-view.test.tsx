import { RegistryProvider } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import { defaultSettings } from "@ivin/contracts/setting"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { NotificationProvider } from "../core/components/notification/notification.tsx"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import { builtinPlugins } from "./builtin-plugins.ts"
import { PluginsProvider } from "./plugin-host.tsx"

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

const step = (position: number, text: string): TranscriptItem => ({
  ...base,
  id: `step-${position}`,
  position,
  parentToolCallId: "call-k1",
  type: "message",
  role: "assistant",
  text,
  images: [],
  steer: false,
})

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
  task(1, review),
  task(2, tests),
  step(3, "I read the session runner first."),
]

const placementSetting = (value: "sheet" | "subView") => ({
  settings: defaultSettings,
  problem: null,
  pluginSettings: [
    {
      pluginId: "tool-calls",
      pluginName: "Tool calls",
      key: "task.placement",
      type: "string" as const,
      default: "sheet",
      title: "Task placement",
      description: "Where Task opens.",
      values: ["sheet", "subView"],
      value,
      ignored: false,
    },
  ],
})

const mount = async ({
  placement,
  session = {},
}: { placement?: "subView"; session?: Partial<Session> } = {}) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Fix the double stop",
      projectPath: "/p",
      started: true,
      status: "in_background",
      backgroundTasks: [review, tests],
      ...session,
    }),
  )
  server.seedItems("s1", items)
  server.openTab("s1")
  if (placement !== undefined) server.setUserSettings(placementSetting(placement))
  await page.viewport(1400, 900)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <NotificationProvider>
          {/* Isolated like the app's #root, so menus portalled to <body> paint over the sheet. */}
          <div
            style={{ height: 800, display: "flex", flexDirection: "column", isolation: "isolate" }}
          >
            <TabView projectPath="/p" />
          </div>
        </NotificationProvider>
      </PluginsProvider>
    </RegistryProvider>,
  )
  await page.getByTestId("background-line").click()
  return server
}

const details = (name: string) =>
  page.getByTestId("background-task").filter({ hasText: name }).getByTestId("task-details")
const sheet = () => page.getByTestId("view-sheet")
const card = () => page.getByRole("region", { name: "Open files" })

test("a task's pill opens its view in the sheet, following the subagent's new steps", async () => {
  const server = await mount()
  await details("Review the diff").click()

  await expect.element(sheet().getByRole("tab", { name: "Review the diff" })).toBeVisible()
  await expect.element(sheet().getByText("I read the session runner first.")).toBeVisible()
  server.pushItem(step(4, "Found it: the stop path reads the list before the lock."))
  await expect
    .element(sheet().getByText("Found it: the stop path reads the list before the lock."))
    .toBeVisible()
})

test("with the placement setting on subView, a task opens beside the chat and follows its steps", async () => {
  const server = await mount({ placement: "subView" })
  await details("Review the diff").click()

  await expect.element(card().getByRole("tab", { name: "Review the diff" })).toBeVisible()
  expect(sheet().query()).toBeNull()
  await expect.element(card().getByText("I read the session runner first.")).toBeVisible()
  server.pushItem(step(4, "Found it: the stop path reads the list before the lock."))
  await expect
    .element(card().getByText("Found it: the stop path reads the list before the lock."))
    .toBeVisible()
})

test("each task opens in a tab of its own, and a command's output follows live", async () => {
  const server = await mount()
  await details("Review the diff").click()
  await details("End-to-end tests").click()

  await expect.element(sheet().getByRole("tab", { name: "Review the diff" })).toBeVisible()
  await expect
    .element(sheet().getByRole("tab", { name: "End-to-end tests", selected: true }))
    .toBeVisible()
  await expect.element(sheet().getByText("No output yet")).toBeVisible()
  server.taskOutputs.set("s1/k2", "shard 2/3 started\n")
  // The command is read once a second.
  await expect
    .poll(() => sheet().getByTestId("task-output").element().textContent, { timeout: 5000 })
    .toContain("shard 2/3 started")
})

test("Escape closes the task's sheet before it interrupts the agent", async () => {
  await mount({ session: { status: "working" } })
  await details("Review the diff").click()
  await expect.element(sheet()).toBeVisible()

  await userEvent.keyboard("{Escape}")
  await expect.poll(() => sheet().query()).toBeNull()
  await expect.element(page.getByTestId("composer-session-status")).not.toHaveTextContent("Idle")

  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
})
