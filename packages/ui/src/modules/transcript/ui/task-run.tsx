import { useAtom, useAtomValue } from "@effect/atom-react"
import { useMemo } from "react"
import { CodeBlock } from "../../../core/components/code-block/code-block.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { taskStepsOf, type TaskItem } from "../atoms/background-tasks.ts"
import { foldsOf } from "../atoms/folds.ts"
import { useTaskOutput } from "../hooks/use-task-output.ts"
import { duration, earlierSteps, turnWork, type TurnWork as Work } from "../rules/turns.ts"
import { EarlierStepsLine, ElapsedClock, StepView } from "./turn-work.tsx"

// A subagent's run drawn as the agent's own turn: its last steps in the fold, every step in the sheet.
export function AgentRun({
  sessionId,
  task,
  lastOnly,
}: {
  sessionId: string
  task: TaskItem
  lastOnly: boolean
}) {
  const steps = useAtomValue(taskStepsOf(sessionId)(task.toolCallId))
  const work = useMemo(() => turnWork(task.id, steps, steps), [task.id, steps])
  const running = task.status === "running"
  // The preview and the sheet draw the same steps, each with its own folds.
  const [folds, setFolds] = useAtom(foldsOf(sessionId))
  const scope = lastOnly ? "peek" : "sheet"
  const toggle = (key: string, open: boolean) => setFolds(new Map(folds).set(key, !open))
  const earlier = lastOnly ? earlierSteps(work, true) : []
  const earlierKey = `${scope}:${task.id}:earlier`
  const earlierOpen = folds.get(earlierKey) ?? false
  const firstShown = earlierOpen ? 0 : earlier.length

  return (
    <div className="iv-turn" data-testid="task-run" data-live={running || undefined}>
      {!lastOnly && <RunLine task={task} work={work} />}
      {work.steps.length > 0 && (
        <div className="iv-turn__timeline">
          {earlier.length > 0 && (
            <EarlierStepsLine
              steps={earlier}
              open={earlierOpen}
              onToggle={() => toggle(earlierKey, earlierOpen)}
            />
          )}
          {work.steps.slice(firstShown).map((step, shownIndex) => {
            const index = firstShown + shownIndex
            const current = running && index === work.steps.length - 1
            const stepKey = `${scope}:${step.id}`
            const open = folds.get(stepKey) ?? (lastOnly ? current : true)
            return (
              <StepView
                key={step.id}
                step={step}
                sessionId={sessionId}
                open={open}
                current={current}
                live={false}
                onToggle={() => toggle(stepKey, open)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function RunLine({ task, work }: { task: TaskItem; work: Work }) {
  const running = task.status === "running"
  const failed = task.status === "failed"
  return (
    <div className="iv-turn__line">
      <span className="iv-turn__lead">
        <span
          className="iv-turn__mark"
          data-state={running ? "running" : undefined}
          data-outcome={running ? undefined : failed ? "failed" : "answered"}
        >
          {running ? (
            <Icon name="loader" size={12} />
          ) : (
            <Icon
              name={failed ? "circle-alert" : task.status === "stopped" ? "square" : "check"}
              size={14}
            />
          )}
        </span>
      </span>
      <span className="iv-turn__label">
        {running ? "Working for " : "Worked for "}
        {running ? <ElapsedClock since={task.at} /> : duration(Math.max(0, work.endAt - task.at))}
      </span>
      <span className="iv-turn__rule" />
    </div>
  )
}

// A command's output; the last `tail` lines in the fold, all of it in the sheet.
export function CommandOutput({
  sessionId,
  task,
  tail,
}: {
  sessionId: string
  task: TaskItem
  tail?: number
}) {
  const output = useTaskOutput(sessionId, task)
  const lines = output.replace(/\n$/, "").split("\n")
  const text = (tail === undefined ? lines : lines.slice(-tail)).join("\n")
  return (
    <div data-testid="task-output">
      {output === "" ? (
        <Text size="sm" tone="muted">
          No output yet
        </Text>
      ) : (
        <CodeBlock text={text} />
      )}
    </div>
  )
}
