import { lazy } from "react"
import {
  Button,
  CodeBlock,
  Disclosure,
  FilePath,
  Icon,
  Stack,
  TaskRun,
  Text,
  defineUi,
  useOpenView,
  useTask,
} from "@ivin/plugin-api/ui"
import type { SlotProps, ToolCallItem } from "@ivin/plugin-api/ui"
import { taskIcon, taskTitle } from "./rules/task-params.ts"
import { filePathArgument, mainArgument, prettyInput } from "./rules/tool-output.ts"
import { toolIcon } from "./rules/tool-icon.ts"

function ToolHeader({
  item,
  main,
  sessionId,
}: {
  item: ToolCallItem
  main: string | null
  sessionId: string
}) {
  const path = filePathArgument(item.name, item.input)
  return (
    <Stack as="span" direction="row" gap={2} align="center" grow>
      <Icon name={toolIcon(item.kind)} size={14} />
      <Text weight="medium">{item.name}</Text>
      <Stack as="span" grow>
        <Text size="sm" tone="muted" mono truncate>
          {path === null ? (main ?? "") : <FilePath sessionId={sessionId} path={path} />}
        </Text>
      </Stack>
      {item.status === "running" && (
        <Text size="sm" tone="muted" data-testid="tool-status">
          <Icon name="loader" size={12} label="running" />
        </Text>
      )}
      {item.status === "error" && (
        <Text size="sm" tone="danger" data-testid="tool-status">
          failed
        </Text>
      )}
    </Stack>
  )
}

// The run replaces the call's output, which only says where the subagent's report went.
function AgentCall({ item, sessionId }: SlotProps["transcript.toolCall"]) {
  const run = useTask(sessionId, item.toolCallId)
  const openView = useOpenView()
  if (run === undefined) return <PlainToolCall item={item} sessionId={sessionId} />
  const openDetails = () =>
    void openView(sessionId, "tool-calls/task", {
      taskId: run.taskId,
      kind: run.kind,
      description: run.description,
    })
  return (
    <Disclosure
      variant="row"
      data-testid="tool-output"
      summary={
        <ToolHeader item={item} main={mainArgument(item.name, item.input)} sessionId={sessionId} />
      }
      actions={
        <Button variant="ghost" size="sm" data-testid="agent-details" onClick={openDetails}>
          Details
        </Button>
      }
    >
      <Stack gap={2}>
        <TaskRun sessionId={sessionId} taskId={run.taskId} preview />
        {item.status === "error" && item.output !== null && <CodeBlock text={item.output} />}
      </Stack>
    </Disclosure>
  )
}

function ToolCall(props: SlotProps["transcript.toolCall"]) {
  return props.item.kind === "agent" ? <AgentCall {...props} /> : <PlainToolCall {...props} />
}

function PlainToolCall({ item, sessionId }: SlotProps["transcript.toolCall"]) {
  const main = mainArgument(item.name, item.input)
  const showInput = main === null && item.input !== undefined
  const header = <ToolHeader item={item} main={main} sessionId={sessionId} />
  // A successful skill call outputs only "Launching skill: <name>", already on the row.
  const quietSkill = item.kind === "skill" && item.status !== "error"
  if ((item.output === null || quietSkill) && !showInput) return header
  return (
    <Disclosure variant="row" data-testid="tool-output" summary={header}>
      <Stack gap={2}>
        {showInput && <CodeBlock text={prettyInput(item.input)} />}
        {item.output !== null && <CodeBlock text={item.output} />}
      </Stack>
    </Disclosure>
  )
}

const TaskView = lazy(() => import("./ui/task-view.tsx").then((m) => ({ default: m.TaskView })))

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.toolCall", ToolCall, { name: "default" })
  ctx.views.register("task", {
    component: TaskView,
    title: taskTitle,
    icon: (params) => <Icon name={taskIcon(params)} size={14} />,
  })
})
