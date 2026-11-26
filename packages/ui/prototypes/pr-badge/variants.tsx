import type { ReactNode } from "react"
import {
  HEALTH_LABEL,
  STATE_LABEL,
  ciOf,
  ciText,
  healthOf,
  leadPr,
  mergeText,
  urlOf,
  worstHealth,
  type Health,
  type Pr,
  type ProtoSession,
} from "./data.ts"
import { CiMark, STATE_ICON, Svg, Window, type Variant } from "./shared.tsx"

function RemoveButton({ pr, onRemove }: { pr: Pr; onRemove: (pr: Pr) => void }) {
  return (
    <button
      type="button"
      className="proto-remove"
      aria-label={`Remove #${pr.number} from this session`}
      title="Remove from this session"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onRemove(pr)
      }}
    >
      <Svg name="x" size={12} />
    </button>
  )
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className="c-pill" data-tone={tone}>
      {children}
    </span>
  )
}

const shortRepo = (repo: string) => repo.split("/")[1]

/* The card all three share: Glyph's list, Chip's labels. */

function MixCard({
  session,
  prs,
  onRemove,
}: {
  session: ProtoSession
  prs: ReadonlyArray<Pr>
  onRemove: (pr: Pr) => void
}) {
  return (
    <div className="m-card">
      <div className="g-card-head">
        {prs.length === 1 ? "Pull request" : `Pull requests · ${prs.length}`}
      </div>
      {prs.map((pr) => {
        const ci = ciOf(pr.checks)
        const live = pr.state === "open" || pr.state === "draft"
        const merge = mergeText(pr)
        return (
          <div key={`${pr.repo}${pr.number}`} className="m-pr">
            <a className="m-pr-link" href={urlOf(pr)} target="_blank" rel="noreferrer">
              <span className="m-state" data-state={pr.state}>
                <Svg name={STATE_ICON[pr.state]} size={16} />
              </span>
              <span className="m-pr-text">
                <span className="m-pr-title">{pr.title}</span>
                <span className="m-pr-meta">
                  <span className="g-mono">
                    {shortRepo(pr.repo)} #{pr.number}
                  </span>
                  <span>·</span>
                  <span>{pr.updated}</span>
                </span>
                <span className="c-pills">
                  {pr.state !== "open" && (
                    <Pill tone={pr.state}>
                      <Svg name={STATE_ICON[pr.state]} size={12} />
                      {STATE_LABEL[pr.state]}
                    </Pill>
                  )}
                  {live && pr.checks.length > 0 && (
                    <Pill tone={ci}>
                      <CiMark ci={ci} />
                      {ciText(pr.checks)}
                    </Pill>
                  )}
                  {merge && (
                    <Pill tone={merge.tone}>
                      {merge.tone === "conflict" && <Svg name="warning" size={12} />}
                      {merge.tone === "ready" && <Svg name="merge" size={12} />}
                      {merge.text}
                    </Pill>
                  )}
                </span>
              </span>
            </a>
            <RemoveButton pr={pr} onRemove={onRemove} />
          </div>
        )
      })}
      {session.error && (
        <div className="proto-card-error">
          <Svg name="warning" size={14} />
          <span>{session.error}</span>
        </div>
      )}
    </div>
  )
}

const label = (prs: ReadonlyArray<Pr>, health: Health) => {
  const lead = leadPr(prs)!
  const base = `Pull request #${lead.number}, ${STATE_LABEL[lead.state]}`
  return health === "none" ? base : `${base}, ${HEALTH_LABEL[health]}`
}

function More({ prs }: { prs: ReadonlyArray<Pr> }) {
  return prs.length > 1 ? <span className="g-more">+{prs.length - 1}</span> : null
}

/* 1. Dot: the icon in its state colour, a dot on its corner for checks and mergeability. */

function DotBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  const health = worstHealth(prs)
  return (
    <span className="d-badge" aria-label={label(prs, health)}>
      <span className="d-icon" data-state={lead.state}>
        <Svg name={STATE_ICON[lead.state]} size={14} />
        {health !== "none" && <span className="d-dot" data-health={health} />}
      </span>
      <More prs={prs} />
    </span>
  )
}

/* 2. Marks: the icon in its state colour, then a checks mark and a merge mark. */

function MarksBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  const health = worstHealth(prs)
  const live = prs.filter((pr) => pr.state === "open")
  const ci = live.some((pr) => ciOf(pr.checks) === "failed")
    ? "failed"
    : live.some((pr) => ciOf(pr.checks) === "running")
      ? "running"
      : live.some((pr) => pr.checks.length > 0)
        ? "passed"
        : "none"
  const conflict = live.some((pr) => pr.conflict)
  const ready = live.length > 0 && live.every((pr) => healthOf(pr) === "ready")
  return (
    <span className="k-badge" aria-label={label(prs, health)}>
      <span className="d-icon" data-state={lead.state}>
        <Svg name={STATE_ICON[lead.state]} size={14} />
      </span>
      <CiMark ci={ci} />
      {conflict && <Svg name="warning" size={13} className="k-conflict" />}
      {ready && <Svg name="merge" size={13} className="k-ready" />}
      <More prs={prs} />
    </span>
  )
}

/* 3. Health: the icon's shape is the state, one colour and tile for checks and mergeability together. */

function HealthBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  const health = worstHealth(prs)
  return (
    <span className="h-badge" aria-label={label(prs, health)}>
      <span className="h-tile" data-state={lead.state} data-health={health}>
        <Svg name={STATE_ICON[lead.state]} size={13} />
      </span>
      <More prs={prs} />
    </span>
  )
}

const dot: Variant = { Badge: DotBadge, Card: MixCard, cardWidth: 340 }
const marks: Variant = { Badge: MarksBadge, Card: MixCard, cardWidth: 340 }
const health: Variant = { Badge: HealthBadge, Card: MixCard, cardWidth: 340 }

export const Dot = () => <Window variant={dot} />
export const Marks = () => <Window variant={marks} />
export const HealthVariant = () => <Window variant={health} />
