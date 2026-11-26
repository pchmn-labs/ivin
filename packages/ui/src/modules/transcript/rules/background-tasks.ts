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

const textField = (input: unknown, field: string): string | null => {
  const value = typeof input === "object" && input !== null ? Reflect.get(input, field) : undefined
  return typeof value === "string" && value !== "" ? value : null
}

// The subagent's last message reaches the transcript as a call to this tool; it reads as the agent's words.
export const handbackAsMessage = (item: TranscriptItem): TranscriptItem => {
  if (item.type !== "tool_call" || item.name !== "SubagentHandback") return item
  const text = textField(item.input, "message")
  if (text === null) return item
  const {
    toolCallId: _call,
    name: _name,
    kind: _kind,
    input: _input,
    status: _s,
    output: _o,
    ...rest
  } = item
  return { ...rest, type: "message", role: "assistant", text, images: [], steer: false }
}

// What the agent was asked to do: the prompt of the call that started the subagent.
export const promptOfTask = (
  items: ReadonlyArray<TranscriptItem>,
  toolCallId: string,
): string | null => {
  const call = items.find((item) => item.type === "tool_call" && item.toolCallId === toolCallId)
  return call?.type === "tool_call" ? textField(call.input, "prompt") : null
}
