import {
  CodeBlock,
  EmptyMessage,
  Stack,
  TaskRun,
  Text,
  useTask,
  useTaskOutput,
} from "@ivin/plugin-api/ui"
import type { ViewProps } from "@ivin/plugin-api/ui"

function CommandOutput({ sessionId, taskId }: { sessionId: string; taskId: string }) {
  const output = useTaskOutput(sessionId, taskId)
  return (
    <div data-testid="task-output">
      {output === "" ? (
        <Text size="sm" tone="muted">
          No output yet
        </Text>
      ) : (
        <CodeBlock text={output.replace(/\n$/, "")} unbounded />
      )}
    </div>
  )
}

function TaskDetail({ sessionId, taskId }: { sessionId: string; taskId: string }) {
  const task = useTask(sessionId, taskId)
  if (task === undefined) return <EmptyMessage>This task is no longer listed.</EmptyMessage>
  return task.kind === "agent" ? (
    <TaskRun sessionId={sessionId} taskId={taskId} />
  ) : (
    <CommandOutput sessionId={sessionId} taskId={taskId} />
  )
}

// A background task's detail: a subagent's whole run, or a command's whole output.
export function TaskView({ sessionId, params, placement }: ViewProps) {
  const taskId = typeof params["taskId"] === "string" ? params["taskId"] : ""
  const detail = <TaskDetail sessionId={sessionId} taskId={taskId} />
  // The sheet and the dialog pad their body; the files card leaves it to the view.
  return placement === "subView" ? <Stack padding={3}>{detail}</Stack> : detail
}
