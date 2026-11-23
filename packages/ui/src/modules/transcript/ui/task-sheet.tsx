import { useAtom, useAtomValue } from "@effect/atom-react"
import { useEffect, useRef } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { ResizeHandle } from "../../../core/components/resize-handle/resize-handle.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { openTaskOf, tasksOf } from "../atoms/background-tasks.ts"
import { TaskMeta, taskIcon } from "./background-fold.tsx"
import { AgentRun, CommandOutput } from "./task-run.tsx"
import "./task-sheet.css"
import "../../tab/ui/sub-view-card.css"

// The sheet floats over the transcript, so a click on the pill of another task switches it instead.
const KEEPS_OPEN = ".iv-task__pill"

// A raised panel docked on the composer: the detail of one background task, with a tab for each task.
export function TaskSheet({ sessionId }: { sessionId: string }) {
  const [openId, setOpenId] = useAtom(openTaskOf(sessionId))
  const tasks = useAtomValue(tasksOf(sessionId))
  const sheet = useRef<HTMLDivElement>(null)
  const task = tasks.find((candidate) => candidate.taskId === openId)
  const close = () => setOpenId(null)
  // The last handler registered wins, so Escape closes the sheet before it interrupts the agent.
  useCommandHandler("session.interrupt", close, openId !== null)

  useEffect(() => {
    if (openId === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (sheet.current?.contains(target) || target.closest(KEEPS_OPEN)) return
      setOpenId(null)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [openId, setOpenId])

  if (task === undefined) return null
  // A task that ended keeps its tab while it is the one shown.
  const shown = tasks.filter((other) => other.status === "running" || other.taskId === task.taskId)
  return (
    <div className="iv-task-sheet" ref={sheet} data-testid="task-sheet" role="region" aria-label={`Task: ${task.description}`}>
      <ResizeHandle
        label="Resize the task sheet"
        edge="top"
        property="--iv-task-sheet-height"
        name="task-sheet"
        min={160}
        max={(element) => (element.parentElement?.getBoundingClientRect().top ?? 400) - 48}
      />
      <div className="iv-sub-view-card__row iv-task-sheet__row">
        <div className="iv-sub-view-card__tabs" role="tablist" aria-label="Tasks in background">
          {shown.map((other) => (
            <div
              key={other.taskId}
              className="iv-sub-view-card__item"
              data-selected={other.taskId === task.taskId || undefined}
            >
              <button
                type="button"
                role="tab"
                aria-selected={other.taskId === task.taskId}
                className="iv-sub-view-card__tab iv-task-sheet__tab"
                onClick={() => setOpenId(other.taskId)}
              >
                <span className="iv-sub-view-card__icon" aria-hidden>
                  <Icon name={taskIcon(other.kind)} size={14} />
                </span>
                <span className="iv-sub-view-card__name">{other.description}</span>
              </button>
            </div>
          ))}
        </div>
        <TaskMeta sessionId={sessionId} task={task} />
        <button
          type="button"
          className="iv-sub-view-card__close iv-task-sheet__close"
          aria-label="Close the task"
          onClick={close}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="iv-task-sheet__body">
        {task.kind === "agent" ? (
          <AgentRun key={task.taskId} sessionId={sessionId} task={task} lastOnly={false} />
        ) : (
          <CommandOutput key={task.taskId} sessionId={sessionId} task={task} />
        )}
      </div>
    </div>
  )
}
