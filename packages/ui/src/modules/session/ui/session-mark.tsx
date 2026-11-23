import { useId } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import type { SessionMarkProps } from "@ivin/plugin-api/ui"
import { HarnessMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { HARNESSES } from "../rules/harnesses.ts"
import { statusLabel } from "@ivin/plugin-api/ui"
import "./session-mark.css"

function ExclamationDisc() {
  return (
    <svg viewBox="0 0 12 12">
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M0 6a6 6 0 1 0 12 0a6 6 0 1 0-12 0ZM5.2 3.1a.8.8 0 0 1 1.6 0v3.6a.8.8 0 0 1-1.6 0ZM5.05 8.9a.95.95 0 1 0 1.9 0a.95.95 0 1 0-1.9 0Z"
      />
    </svg>
  )
}

function QuestionDisc() {
  const cut = useId()
  return (
    <svg viewBox="0 0 12 12">
      <mask id={cut}>
        <rect width="12" height="12" fill="white" />
        <path
          d="M4.35 4.5a1.65 1.65 0 1 1 2.5 1.42c-.55.33-.85.66-.85 1.28v.25"
          fill="none"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="6" cy="9.05" r=".9" fill="black" />
      </mask>
      <circle cx="6" cy="6" r="6" fill="currentColor" mask={`url(#${cut})`} />
    </svg>
  )
}

function TaskList({ tasks }: { tasks: NonNullable<SessionMarkProps["tasks"]> }) {
  return (
    <ul className="iv-session-mark__tasks">
      {tasks.map((task) => (
        <li key={task.taskId}>
          <Icon name={task.kind === "agent" ? "robot" : "terminal"} size={12} />
          <span>{task.description}</span>
        </li>
      ))}
    </ul>
  )
}

export function SessionMark({ status, harness, waitingFor = null, tasks = [] }: SessionMarkProps) {
  const asks = status === "waiting" && waitingFor === "question"
  const mark = (
    <span
      className="iv-session-mark"
      data-status={status}
      data-waiting-for={status === "waiting" ? (waitingFor ?? undefined) : undefined}
    >
      <HarnessMark mark={HARNESSES[harness].mark} />
      <span className="iv-session-mark__overlay" aria-hidden="true">
        {status === "waiting" && (asks ? <QuestionDisc /> : <ExclamationDisc />)}
      </span>
      <span className="iv-visually-hidden">
        {asks ? "Waiting for your answer" : statusLabel(status)}
      </span>
    </span>
  )
  if (status !== "in_background" || tasks.length === 0) return mark
  return (
    <Tooltip
      side="bottom"
      label={tasks.length === 1 ? "1 task in background" : `${tasks.length} tasks in background`}
      content={<TaskList tasks={tasks} />}
    >
      {mark}
    </Tooltip>
  )
}
