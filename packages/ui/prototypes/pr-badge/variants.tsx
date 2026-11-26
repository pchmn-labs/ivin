import { useState, type ReactNode } from "react"
import {
  REVIEW_LABEL,
  STATE_LABEL,
  anyConflict,
  ciOf,
  ciText,
  count,
  leadPr,
  urlOf,
  worstCi,
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

function CardError({ session }: { session: ProtoSession }) {
  if (!session.error) return null
  return (
    <div className="proto-card-error">
      <Svg name="warning" size={14} />
      <span>{session.error}</span>
    </div>
  )
}

const shortRepo = (repo: string) => repo.split("/")[1]

/* 1. Glyph: one icon, its shape the state, its colour the checks. */

function GlyphBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  const live = lead.state === "open" || lead.state === "draft"
  return (
    <span className="g-badge" data-state={lead.state} data-ci={live ? worstCi(prs) : undefined}>
      <span className="g-icon">
        <Svg name={STATE_ICON[lead.state]} size={14} />
        {anyConflict(prs) && <span className="g-conflict" />}
      </span>
      {prs.length > 1 && <span className="g-more">+{prs.length - 1}</span>}
    </span>
  )
}

function GlyphCard({ session, prs, onRemove }: { session: ProtoSession; prs: ReadonlyArray<Pr>; onRemove: (pr: Pr) => void }) {
  return (
    <div className="g-card">
      <div className="g-card-head">
        {prs.length === 1 ? "Pull request" : `Pull requests · ${prs.length}`}
      </div>
      {prs.map((pr) => {
        const ci = ciOf(pr.checks)
        const live = pr.state === "open" || pr.state === "draft"
        return (
          <div key={`${pr.repo}${pr.number}`} className="g-pr">
           <a className="g-pr-link" href={urlOf(pr)} target="_blank" rel="noreferrer">
            <span className="g-badge" data-state={pr.state} data-ci={live ? ci : undefined}>
              <span className="g-icon"><Svg name={STATE_ICON[pr.state]} size={14} /></span>
            </span>
            <span className="g-pr-text">
              <span className="g-pr-title">{pr.title}</span>
              <span className="g-pr-meta">
                <span className="g-mono">{shortRepo(pr.repo)} #{pr.number}</span>
                <span>{STATE_LABEL[pr.state]}</span>
                {live && pr.checks.length > 0 && <span data-ci={ci}>{ciText(pr.checks)}</span>}
                {live && pr.review && <span data-review={pr.review}>{REVIEW_LABEL[pr.review]}</span>}
                {live && pr.conflict && <span className="g-danger">Conflicts</span>}
              </span>
            </span>
           </a>
            <RemoveButton pr={pr} onRemove={onRemove} />
          </div>
        )
      })}
      <CardError session={session} />
    </div>
  )
}

/* 2. Chip: a labelled pill, state colour, number and checks mark. */

function ChipBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  const live = lead.state === "open" || lead.state === "draft"
  const conflict = anyConflict(prs)
  return (
    <span className="c-chip" data-state={lead.state} data-conflict={conflict || undefined}>
      <Svg name={STATE_ICON[lead.state]} size={12} />
      <span className="c-num">#{lead.number}</span>
      {live && <CiMark ci={worstCi(prs)} />}
      {conflict && <Svg name="warning" size={11} className="c-warn" />}
      {prs.length > 1 && <span className="c-more">+{prs.length - 1}</span>}
    </span>
  )
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className="c-pill" data-tone={tone}>{children}</span>
}

function ChipCard({ session, prs, onRemove }: { session: ProtoSession; prs: ReadonlyArray<Pr>; onRemove: (pr: Pr) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? prs : prs.slice(0, 2)
  return (
    <div className="c-card">
      {shown.map((pr) => {
        const ci = ciOf(pr.checks)
        const live = pr.state === "open" || pr.state === "draft"
        return (
          <div key={`${pr.repo}${pr.number}`} className="c-pr">
           <a className="c-pr-link" href={urlOf(pr)} target="_blank" rel="noreferrer">
            <span className="c-pr-head">
              <span className="g-mono">{pr.repo} #{pr.number}</span>
              <span className="c-dot">·</span>
              <span>{pr.updated}</span>
            </span>
            <span className="c-pr-title">{pr.title}</span>
            <span className="c-pills">
              <Pill tone={pr.state}>
                <Svg name={STATE_ICON[pr.state]} size={12} />
                {STATE_LABEL[pr.state]}
              </Pill>
              {live && pr.checks.length > 0 && (
                <Pill tone={ci}>
                  <CiMark ci={ci} />
                  {ciText(pr.checks)}
                </Pill>
              )}
              {live && pr.review && <Pill tone={pr.review}>{REVIEW_LABEL[pr.review]}</Pill>}
              {live && pr.conflict && (
                <Pill tone="failed">
                  <Svg name="warning" size={12} />
                  Conflicts with main
                </Pill>
              )}
            </span>
           </a>
            <RemoveButton pr={pr} onRemove={onRemove} />
          </div>
        )
      })}
      {prs.length > 2 && !all && (
        <button type="button" className="c-more-button" onClick={() => setAll(true)}>
          Show {prs.length - 2} more
        </button>
      )}
      <CardError session={session} />
    </div>
  )
}

/* 3. Ring: the checks as a ring around the state icon, a card that names each check. */

function Ring({ pr, size }: { pr: Pr; size: number }) {
  const live = pr.state === "open" || pr.state === "draft"
  const r = size / 2 - 1.25
  const c = 2 * Math.PI * r
  const total = pr.checks.length
  let offset = 0
  const arcs = live && total > 0
    ? (["passed", "running", "failed"] as const).map((result) => {
        const n = count(pr.checks, result)
        const len = (n / total) * c
        const arc = { result, len, offset }
        offset += len
        return arc
      })
    : []
  const icon = Math.round(size * 0.55)
  return (
    <span className="r-ring" data-state={pr.state} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="r-track" />
        {arcs.map((a) =>
          a.len === 0 ? null : (
            <circle
              key={a.result}
              cx={size / 2}
              cy={size / 2}
              r={r}
              className="r-arc"
              data-ci={a.result}
              strokeDasharray={`${Math.max(a.len - 1, 0.5)} ${c}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ),
        )}
      </svg>
      <Svg name={STATE_ICON[pr.state]} size={icon} className="r-icon" />
    </span>
  )
}

function RingBadge({ prs }: { prs: ReadonlyArray<Pr> }) {
  const lead = leadPr(prs)!
  return (
    <span className="r-badge">
      <Ring pr={lead} size={18} />
      {anyConflict(prs) && <span className="g-conflict r-conflict" />}
      {prs.length > 1 && <span className="g-more">+{prs.length - 1}</span>}
    </span>
  )
}

function RingCard({ session, prs, onRemove }: { session: ProtoSession; prs: ReadonlyArray<Pr>; onRemove: (pr: Pr) => void }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="r-card">
      {prs.map((pr, i) => {
        const live = pr.state === "open" || pr.state === "draft"
        const expanded = i === open
        const notable = pr.checks.filter((c) => c.result !== "passed")
        const passedN = count(pr.checks, "passed")
        return (
          <div key={`${pr.repo}${pr.number}`} className="r-pr" data-expanded={expanded || undefined}>
            <div className="r-pr-head">
            <button type="button" className="r-pr-toggle" onClick={() => setOpen(i)} aria-expanded={expanded}>
              <Ring pr={pr} size={22} />
              <span className="r-pr-text">
                <span className="r-pr-title">{pr.title}</span>
                <span className="r-pr-meta">
                  <span className="g-mono">{pr.repo} #{pr.number}</span>
                  <span>· {STATE_LABEL[pr.state]}</span>
                </span>
              </span>
            </button>
              <RemoveButton pr={pr} onRemove={onRemove} />
            </div>
            {expanded && (
              <div className="r-detail">
                {live && pr.checks.length > 0 && (
                  <ul className="r-checks">
                    {notable.map((c) => (
                      <li key={c.name} data-ci={c.result}>
                        <CiMark ci={c.result} />
                        <span className="g-mono">{c.name}</span>
                        <span className="r-time">{c.time}</span>
                      </li>
                    ))}
                    {passedN > 0 && (
                      <li data-ci="passed">
                        <CiMark ci="passed" />
                        <span>{passedN} checks passed</span>
                      </li>
                    )}
                  </ul>
                )}
                {live && pr.checks.length === 0 && <div className="r-line">No checks have run.</div>}
                {live && pr.review && (
                  <div className="r-line" data-review={pr.review}>{REVIEW_LABEL[pr.review]}</div>
                )}
                {live && pr.conflict && (
                  <div className="r-line g-danger">
                    <Svg name="warning" size={12} /> Conflicts with main
                  </div>
                )}
                {!live && <div className="r-line">{STATE_LABEL[pr.state]} {pr.updated}</div>}
                <a className="r-open" href={urlOf(pr)} target="_blank" rel="noreferrer">
                  Open on GitHub <Svg name="external" size={12} />
                </a>
              </div>
            )}
          </div>
        )
      })}
      <CardError session={session} />
    </div>
  )
}

const glyph: Variant = { Badge: GlyphBadge, Card: GlyphCard, cardWidth: 320 }
const chip: Variant = { Badge: ChipBadge, Card: ChipCard, cardWidth: 360 }
const ring: Variant = { Badge: RingBadge, Card: RingCard, cardWidth: 380 }

export const Glyph = () => <Window variant={glyph} />
export const Chip = () => <Window variant={chip} />
export const RingVariant = () => <Window variant={ring} />
