import { useAtom, useAtomValue } from "@effect/atom-react"
import { useEffect, useState, type ReactNode } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { Icon, type IconName } from "../../../core/components/icon/icon.tsx"
import { ItemSlot } from "./transcript-row.tsx"
import { transcriptOf } from "../atoms/get-items.ts"
import { foldsOf } from "../atoms/folds.ts"
import { useFollowEnd } from "../hooks/use-follow-end.ts"
import {
  SHOWN_CALLS_WHILE_LIVE,
  callPhrases,
  duration,
  earlierSteps,
  earlierStepsKey,
  pinnedCalls,
  stepOpenByDefault,
  turnOpenByDefault,
  turnVerb,
  type Outcome,
  type Step,
  type TurnWork as Work,
} from "../rules/turns.ts"
import "./turn-work.css"

export function ElapsedClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span data-testid="turn-clock">{duration(now - since)}</span>
}

export function Failed({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <>
      <span className="iv-turn__dot"> · </span>
      <span className="iv-turn__failed">{count} failed</span>
    </>
  )
}

export function StepView({
  step,
  sessionId,
  open,
  current,
  live,
  onToggle,
}: {
  step: Step
  sessionId: string
  open: boolean
  current: boolean
  live: boolean
  onToggle: () => void
}) {
  const shown = step.calls.length === 0 || open ? step.children : pinnedCalls(step)
  const scrolls = live && open && shown.length > SHOWN_CALLS_WHILE_LIVE
  const follow = useFollowEnd<HTMLDivElement>(scrolls ? shown : null)
  const running = current && step.calls.some((call) => call.status === "running")
  return (
    <div
      className="iv-turn__step"
      data-testid="turn-step"
      data-failed={step.failed > 0 || undefined}
      data-current={current || undefined}
      data-steer={step.steer ? true : undefined}
    >
      {step.steer && (
        <div className="iv-turn__steer" data-testid="turn-steer">
          <Slot slot="transcript.message" props={{ item: step.steer, sessionId }} />
        </div>
      )}
      {step.sentence && (
        <div className="iv-turn__sentence">
          <Slot slot="transcript.message" props={{ item: step.sentence, sessionId }} />
        </div>
      )}
      {step.calls.length > 0 && (
        <button
          type="button"
          className="iv-turn__summary"
          aria-expanded={open}
          data-testid="step-summary"
          onClick={onToggle}
        >
          <span className="iv-turn__lead">
            <span className="iv-turn__mark" data-state={running ? "running" : undefined}>
              {running ? <Icon name="loader" size={12} /> : <Icon name="stack" size={14} />}
            </span>
            <span className="iv-turn__chevron">
              <Icon name="chevron-right" size={12} />
            </span>
          </span>
          <span className="iv-turn__phrases">
            {callPhrases(step.calls).join(" · ")}
            <Failed count={step.failed} />
          </span>
        </button>
      )}
      {shown.length > 0 && (
        <div
          ref={follow.ref}
          className="iv-turn__calls"
          data-scroll={scrolls || undefined}
          onScroll={scrolls ? follow.onScroll : undefined}
          onWheel={scrolls ? follow.onWheel : undefined}
        >
          {shown.map((item) => (
            <div key={item.id} className="iv-turn__call">
              <ItemSlot item={item} sessionId={sessionId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Kept in view while the turn is open; a check gives way to the chevron.
const STATE_MARKS = new Set<Outcome>(["stopped", "failed"])

const MARKS: Record<Outcome, IconName> = {
  answered: "check",
  silent: "check",
  stopped: "square",
  failed: "circle-alert",
}

function TurnLine({ work, live }: { work: Work; live: boolean }): ReactNode {
  const verb = turnVerb(work.outcome, live)
  return (
    <>
      <span className="iv-turn__lead">
        <span
          className="iv-turn__mark"
          data-outcome={live ? undefined : work.outcome}
          data-state={live ? "running" : STATE_MARKS.has(work.outcome) ? work.outcome : undefined}
        >
          {live ? <Icon name="loader" size={12} /> : <Icon name={MARKS[work.outcome]} size={14} />}
        </span>
        <span className="iv-turn__chevron">
          <Icon name="chevron-right" size={12} />
        </span>
      </span>
      <span className="iv-turn__label">
        {verb} {live ? <ElapsedClock since={work.startAt} /> : duration(work.endAt - work.startAt)}
        {!live && (
          <>
            <span className="iv-turn__dot"> · </span>
            {work.calls} {work.calls === 1 ? "tool call" : "tool calls"}
          </>
        )}
        <Failed count={work.failed} />
      </span>
      <span className="iv-turn__rule" />
    </>
  )
}

export function EarlierStepsLine({
  steps,
  open,
  onToggle,
}: {
  steps: ReadonlyArray<Step>
  open: boolean
  onToggle: () => void
}) {
  const count = `${steps.length} ${steps.length === 1 ? "earlier step" : "earlier steps"}`
  return (
    <div className="iv-turn__earlier">
      <button
        type="button"
        className="iv-turn__earlier-line"
        aria-expanded={open}
        data-testid="earlier-steps"
        onClick={onToggle}
      >
        <span>
          {open ? `Hide ${count}` : count}
          <Failed count={steps.reduce((sum, step) => sum + step.failed, 0)} />
        </span>
        <span className="iv-turn__chevron">
          <Icon name="chevron-right" size={12} />
        </span>
      </button>
    </div>
  )
}

export function TurnWork({
  sessionId,
  rowId,
  live,
}: {
  sessionId: string
  rowId: string
  live: boolean
}) {
  const work = useAtomValue(transcriptOf(sessionId).work(live)(rowId))
  const [folds, setFolds] = useAtom(foldsOf(sessionId))
  if (work === null) return null
  const toggle = (key: string, open: boolean) => setFolds(new Map(folds).set(key, !open))
  const open = folds.get(rowId) ?? turnOpenByDefault(work, live)
  const earlier = earlierSteps(work, live)
  const earlierOpen = folds.get(earlierStepsKey(rowId)) ?? false
  const firstShown = earlierOpen ? 0 : earlier.length

  return (
    <div className="iv-turn" data-testid="turn" data-live={live || undefined}>
      {work.steps.length === 0 ? (
        <div className="iv-turn__line">
          <TurnLine work={work} live={live} />
        </div>
      ) : (
        <button
          type="button"
          className="iv-turn__line iv-turn__line--toggle"
          aria-expanded={open}
          data-testid="turn-line"
          onClick={() => toggle(rowId, open)}
        >
          <TurnLine work={work} live={live} />
        </button>
      )}
      {open && work.steps.length > 0 && (
        <div className="iv-turn__timeline">
          {earlier.length > 0 && (
            <EarlierStepsLine
              steps={earlier}
              open={earlierOpen}
              onToggle={() => toggle(earlierStepsKey(rowId), earlierOpen)}
            />
          )}
          {work.steps.slice(firstShown).map((step, shownIndex) => {
            const index = firstShown + shownIndex
            const stepOpen = folds.get(step.id) ?? stepOpenByDefault(work, index, live)
            return (
              <StepView
                key={step.id}
                step={step}
                sessionId={sessionId}
                open={stepOpen}
                current={live && index === work.steps.length - 1}
                live={live}
                onToggle={() => toggle(step.id, stepOpen)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const PROMPT_LINES_FOLDED = 4

export function PromptBubble({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false)
  const long = prompt.split("\n").length > PROMPT_LINES_FOLDED || prompt.length > 400
  return (
    <div
      className="iv-turn__prompt"
      data-testid="task-prompt"
      data-folded={long && !open ? true : undefined}
    >
      <span className="iv-turn__prompt-text">{prompt}</span>
      {long && (
        <button
          type="button"
          className="iv-turn__prompt-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
