import { useAtom, useAtomValue } from "@effect/atom-react"
import { useEffect, useState, type ReactNode } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { ItemSlot } from "./transcript-row.tsx"
import { transcriptOf } from "../atoms/get-items.ts"
import { foldsOf } from "../atoms/folds.ts"
import {
  callPhrases,
  duration,
  pinnedCalls,
  stepsOpenByDefault,
  turnOpenByDefault,
  turnVerb,
  type Step,
  type TurnWork as Work,
} from "../rules/turns.ts"
import "./turn-work.css"

function ElapsedClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span data-testid="turn-clock">{duration(now - since)}</span>
}

function Failed({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <>
      <span className="iv-turn__dot"> · </span>
      <span className="iv-turn__failed">{count} failed</span>
    </>
  )
}

function StepView({
  step,
  sessionId,
  open,
  onToggle,
}: {
  step: Step
  sessionId: string
  open: boolean
  onToggle: () => void
}) {
  const shown = step.calls.length === 0 || open ? step.children : pinnedCalls(step)
  return (
    <div
      className="iv-turn__step"
      data-testid="turn-step"
      data-failed={step.failed > 0 || undefined}
    >
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
            <span className="iv-turn__stack">
              <Icon name="stack" size={14} />
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
        <div className="iv-turn__calls">
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

type Latest = NonNullable<Work["latest"]>

function LatestLine({ latest, sessionId }: { latest: Latest; sessionId: string }) {
  if (latest.type === "call") return <ItemSlot item={latest.item} sessionId={sessionId} />
  return <span className="iv-turn__note">{latest.item.text.split("\n", 1)[0]}</span>
}

function LatestStep({ latest, sessionId }: { latest: Latest; sessionId: string }) {
  const [shown, setShown] = useState<{ current: Latest; leaving: Latest | null }>({
    current: latest,
    leaving: null,
  })
  if (shown.current.item.id !== latest.item.id) {
    setShown({ current: latest, leaving: shown.current })
  } else if (shown.current !== latest) {
    setShown({ ...shown, current: latest })
  }
  return (
    <div className="iv-turn__latest" data-testid="turn-latest">
      {shown.leaving && (
        <div
          key={shown.leaving.item.id}
          className="iv-turn__tick iv-turn__tick--out"
          aria-hidden
          onAnimationEnd={() => setShown((s) => ({ ...s, leaving: null }))}
        >
          <LatestLine latest={shown.leaving} sessionId={sessionId} />
        </div>
      )}
      <div
        key={shown.current.item.id}
        className={shown.leaving ? "iv-turn__tick iv-turn__tick--in" : "iv-turn__tick"}
      >
        <LatestLine latest={shown.current} sessionId={sessionId} />
      </div>
    </div>
  )
}

function TurnLine({ work, live }: { work: Work; live: boolean }): ReactNode {
  const verb = turnVerb(work.outcome, live)
  return (
    <>
      {live && (
        <span className="iv-turn__spinner">
          <Icon name="loader" size={12} />
        </span>
      )}
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

export function TurnWork({
  sessionId,
  rowId,
  live,
}: {
  sessionId: string
  rowId: string
  live: boolean
}) {
  const work = useAtomValue(transcriptOf(sessionId).work(rowId))
  const [folds, setFolds] = useAtom(foldsOf(sessionId))
  if (work === null) return null
  const toggle = (key: string, open: boolean) => setFolds(new Map(folds).set(key, !open))
  const open = folds.get(rowId) ?? turnOpenByDefault(work, live)
  const stepsOpen = stepsOpenByDefault(work)

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
          <span className="iv-turn__hang">
            <Icon name="chevron-right" size={12} />
          </span>
          <TurnLine work={work} live={live} />
        </button>
      )}
      {open ? (
        <div className="iv-turn__timeline">
          {work.steps.map((step) => {
            const stepOpen = folds.get(step.id) ?? stepsOpen
            return (
              <StepView
                key={step.id}
                step={step}
                sessionId={sessionId}
                open={stepOpen}
                onToggle={() => toggle(step.id, stepOpen)}
              />
            )
          })}
        </div>
      ) : (
        live && work.latest && <LatestStep latest={work.latest} sessionId={sessionId} />
      )}
    </div>
  )
}
