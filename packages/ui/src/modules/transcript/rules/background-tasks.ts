import type { BackgroundTask } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"

export type TaskItem = Extract<TranscriptItem, { type: "task" }>

const taskItemOf = (sessionId: string, task: BackgroundTask): TaskItem => ({
  id: task.itemId,
  sessionId,
  position: 0,
  at: task.at,
  type: "task",
  taskId: task.taskId,
  toolCallId: task.toolCallId,
  kind: task.kind,
  description: task.description,
  status: "running",
  summary: null,
  output: null,
})

// A running task's item may sit before the loaded page; the session's list stands in for it then.
export const runningTasks = (
  sessionId: string,
  background: ReadonlyArray<BackgroundTask>,
  loaded: ReadonlyArray<TaskItem>,
): TaskItem[] =>
  background.map(
    (task) => loaded.find((item) => item.taskId === task.taskId) ?? taskItemOf(sessionId, task),
  )

export const knownTasks = (
  sessionId: string,
  background: ReadonlyArray<BackgroundTask>,
  loaded: ReadonlyArray<TaskItem>,
): TaskItem[] => [
  ...background
    .filter((task) => !loaded.some((item) => item.taskId === task.taskId))
    .map((task) => taskItemOf(sessionId, task)),
  ...loaded,
]
