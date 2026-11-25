import { useAtom, useAtomValue } from "@effect/atom-react"
import { useEffect, useRef } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { SheetFrame } from "../../../core/components/sheet-frame/sheet-frame.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import type { BackgroundTask } from "@ivin/contracts/session"
import { openTaskOf, tasksOf } from "../atoms/background-tasks.ts"
import { knownTasks } from "../rules/background-tasks.ts"
import { TaskMeta, taskIcon } from "./background-fold.tsx"
import { AgentRun, CommandOutput } from "./task-run.tsx"
import "./task-sheet.css"

// The sheet floats over the transcript, so a click on the pill of another task switches it instead.
const KEEPS_OPEN = ".iv-task__pill"

// A raised panel docked on the composer: the detail of one background task, with a tab for each task.
export function TaskSheet({
  sessionId,
  background,
}: {
  sessionId: string
  background: ReadonlyArray<BackgroundTask>
}) {
  const [openId, setOpenId] = useAtom(openTaskOf(sessionId))
  const tasks = knownTasks(sessionId, background, useAtomValue(tasksOf(sessionId)))
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
    <SheetFrame
      ref={sheet}
      className="iv-task-sheet"
      testId="task-sheet"
      label={`Task: ${task.description}`}
      resizeLabel="Resize the task sheet"
      resizeName="task-sheet"
      closeLabel="Close the task"
      onClose={close}
      aside={<TaskMeta sessionId={sessionId} task={task} />}
      tabs={
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
                className="iv-sub-view-card__tab iv-sheet__tab"
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
      }
    >
      {task.kind === "agent" ? (
        <AgentRun key={task.taskId} sessionId={sessionId} task={task} lastOnly={false} />
      ) : (
        <CommandOutput key={task.taskId} sessionId={sessionId} task={task} />
      )}
    </SheetFrame>
  )
}
