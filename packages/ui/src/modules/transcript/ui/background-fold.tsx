import { useAtom, useAtomValue } from "@effect/atom-react"
import type { BackgroundTask } from "@ivin/contracts/session"
import { useRef } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { foldsOf } from "../atoms/folds.ts"
import { openTaskOf, tasksOf, taskStepsOf } from "../atoms/background-tasks.ts"
import { runningTasks, type TaskItem } from "../rules/background-tasks.ts"
import { AgentRun, CommandOutput } from "./task-run.tsx"
import { ElapsedClock } from "./turn-work.tsx"
import "./background-fold.css"

const FOLD_KEY = "background-tasks"
const ROW_PREVIEW_LINES = 5

export const taskIcon = (kind: BackgroundTask["kind"]) => (kind === "agent" ? "robot" : "terminal")

// What a task has done so far: a subagent's tool calls and failures, how long a command runs.
export function TaskMeta({ sessionId, task }: { sessionId: string; task: TaskItem }) {
  const steps = useAtomValue(taskStepsOf(sessionId)(task.toolCallId))
  if (task.kind === "command") {
    return (
      <span className="iv-task-meta" data-testid="task-meta">
        {task.status === "running" ? (
          <>
            running <ElapsedClock since={task.at} />
          </>
        ) : (
          task.status
        )}
      </span>
    )
  }
  const calls = steps.filter((item) => item.type === "tool_call")
  const failed = calls.filter((call) => call.status === "error").length
  return (
    <span className="iv-task-meta" data-testid="task-meta">
      {calls.length} {calls.length === 1 ? "tool call" : "tool calls"}
      {failed > 0 && <span className="iv-turn__failed"> · {failed} failed</span>}
    </span>
  )
}

function TaskRow({ sessionId, task }: { sessionId: string; task: TaskItem }) {
  const [folds, setFolds] = useAtom(foldsOf(sessionId))
  const key = `task:${task.taskId}`
  const open = folds.get(key) ?? false
  const [openTask, setOpenTask] = useAtom(openTaskOf(sessionId))
  const active = openTask === task.taskId
  return (
    <div className="iv-task" data-active={active || undefined} data-testid="background-task">
      <button
        type="button"
        className="iv-task__row"
        aria-expanded={open}
        onClick={() => setFolds(new Map(folds).set(key, !open))}
      >
        <Icon name={taskIcon(task.kind)} size={14} />
        <span className="iv-task__name">{task.description}</span>
        <span
          role="button"
          tabIndex={0}
          className="iv-task__pill"
          data-testid="task-details"
          onClick={(event) => {
            event.stopPropagation()
            setOpenTask(task.taskId)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            event.stopPropagation()
            setOpenTask(task.taskId)
          }}
        >
          {task.kind === "agent" ? "Details" : "Output"}
        </span>
        <span className="iv-task__spacer" />
        <TaskMeta sessionId={sessionId} task={task} />
        <span className="iv-task__chevron" data-open={open || undefined}>
          <Icon name="chevron-right" size={12} />
        </span>
      </button>
      {open && (
        <div className="iv-task__peek">
          {task.kind === "agent" ? (
            <AgentRun sessionId={sessionId} task={task} lastOnly />
          ) : (
            <CommandOutput sessionId={sessionId} task={task} tail={ROW_PREVIEW_LINES} />
          )}
        </div>
      )}
    </div>
  )
}

// Under the last turn while the agent rests on tasks it started: a line that lists them.
export function BackgroundFold({
  sessionId,
  tasks,
}: {
  sessionId: string
  tasks: ReadonlyArray<BackgroundTask>
}) {
  const [folds, setFolds] = useAtom(foldsOf(sessionId))
  const items = useAtomValue(tasksOf(sessionId))
  const open = folds.get(FOLD_KEY) ?? false
  const running = runningTasks(sessionId, tasks, items)
  const fold = useRef<HTMLDivElement>(null)
  if (tasks.length === 0) return null
  const toggle = () => {
    setFolds(new Map(folds).set(FOLD_KEY, !open))
    // The fold sits under the last turn, so the tasks it lists would open below the view.
    if (!open)
      requestAnimationFrame(() =>
        fold.current?.scrollIntoView({
          block: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        }),
      )
  }
  return (
    <div className="iv-transcript__column" data-testid="background-fold" ref={fold}>
      <div className="iv-transcript__item">
        <button
          type="button"
          className="iv-turn__line iv-turn__line--toggle"
          aria-expanded={open}
          data-testid="background-line"
          onClick={toggle}
        >
          <span className="iv-turn__lead">
            <span className="iv-turn__mark" data-state="running">
              <span className="iv-task__dot" aria-hidden="true" />
            </span>
            <span className="iv-turn__chevron">
              <Icon name="chevron-right" size={12} />
            </span>
          </span>
          <span className="iv-turn__label">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} in background
          </span>
          <span className="iv-turn__rule" />
        </button>
        {open && (
          <div className="iv-task__list">
            {running.map((task) => (
              <TaskRow key={task.taskId} sessionId={sessionId} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
