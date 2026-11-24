import type { BackgroundTask } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { knownTasks, runningTasks, type TaskItem } from "./background-tasks.ts"

const listed = (taskId: string): BackgroundTask => ({
  taskId,
  kind: "command",
  description: `Task ${taskId}`,
  itemId: `i-${taskId}`,
  toolCallId: `t-${taskId}`,
  at: 42,
})

const loaded = (taskId: string, status: TaskItem["status"] = "running"): TaskItem => ({
  id: `i-${taskId}`,
  sessionId: "s1",
  position: 7,
  at: 42,
  type: "task",
  taskId,
  toolCallId: `t-${taskId}`,
  kind: "command",
  description: `Task ${taskId}`,
  status,
  summary: null,
  output: null,
})

test("a running task whose item is not loaded is drawn from the session's list", () => {
  expect(runningTasks("s1", [listed("k1")], [])).toEqual([{ ...loaded("k1"), position: 0 }])
})

test("a running task whose item is loaded uses the item", () => {
  const item = { ...loaded("k1"), position: 9 }
  expect(runningTasks("s1", [listed("k1")], [item, loaded("k2", "completed")])).toEqual([item])
})

test("the known tasks are the loaded ones and the running ones outside the loaded page", () => {
  const ended = loaded("k2", "completed")
  expect(knownTasks("s1", [listed("k1"), listed("k2")], [ended]).map((t) => t.taskId)).toEqual([
    "k1",
    "k2",
  ])
})
