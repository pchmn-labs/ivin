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

type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>

const RUN_STATUS = { running: "running", done: "completed", error: "failed" } as const

export const foregroundAgentRun = (
  call: ToolCallItem,
  tasks: ReadonlyArray<TaskItem>,
): TaskItem | undefined => {
  if (call.kind !== "agent") return undefined
  if (tasks.some((task) => task.toolCallId === call.toolCallId)) return undefined
  return {
    id: call.id,
    sessionId: call.sessionId,
    position: call.position,
    at: call.at,
    type: "task",
    taskId: call.toolCallId,
    toolCallId: call.toolCallId,
    kind: "agent",
    description: call.name,
    status: RUN_STATUS[call.status],
    summary: null,
    output: null,
  }
}
