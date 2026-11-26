import type { ReactNode } from "react"
import {
  HEALTH_LABEL,
  STATE_LABEL,
  ciOf,
  ciText,
  isRunning,
  iconToneOf,
  mergeableOf,
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

/* Health: the tile's colour is checks and mergeability once settled; it pulses while checks run. */

function HealthBadge({ prs, check }: { prs: ReadonlyArray<Pr>; check: "corner" | "beside" }) {
  const lead = leadPr(prs)!
  const health = worstHealth(prs)
  const mergeable = mergeableOf(prs)
  const verdict =
    mergeable === "yes" ? "passed" : mergeable === "conflict" || iconToneOf(prs) === "failed" ? "failed" : null
  return (
    <span className="h-badge" aria-label={label(prs, health)}>
      <span
        className="t-tile"
        data-state={lead.state}
        data-mergeable={mergeable}
        data-icon={iconToneOf(prs)}
        data-running={isRunning(prs) || undefined}
      >
        <Svg name={STATE_ICON[lead.state]} size={13} />
        {verdict && check === "corner" && (
          <span className="t-check-corner" data-ci={verdict}>
            <Svg name={verdict === "passed" ? "check" : "xBold"} size={5} />
          </span>
        )}
      </span>
      {verdict && check === "beside" && <CiMark ci={verdict} />}
      <More prs={prs} />
    </span>
  )
}

const variant = (check: "corner" | "beside"): Variant => ({
  Badge: (props) => <HealthBadge {...props} check={check} />,
  Card: MixCard,
  cardWidth: 340,
})
const corner = variant("corner")
const beside = variant("beside")

export const Corner = () => <Window variant={corner} />
export const Beside = () => <Window variant={beside} />
