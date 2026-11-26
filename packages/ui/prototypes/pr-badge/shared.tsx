import { PreviewCard } from "@base-ui/react/preview-card"
import { useState, type ComponentType, type ReactNode } from "react"
import pullRequest from "@phosphor-icons/core/assets/regular/git-pull-request.svg?raw"
import merge from "@phosphor-icons/core/assets/regular/git-merge.svg?raw"
import xCircle from "@phosphor-icons/core/assets/regular/x-circle.svg?raw"
import circleDashed from "@phosphor-icons/core/assets/regular/circle-dashed.svg?raw"
import x from "@phosphor-icons/core/assets/regular/x.svg?raw"
import check from "@phosphor-icons/core/assets/bold/check-bold.svg?raw"
import xBold from "@phosphor-icons/core/assets/bold/x-bold.svg?raw"
import warning from "@phosphor-icons/core/assets/regular/warning-circle.svg?raw"
import external from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw"
import plus from "@phosphor-icons/core/assets/regular/plus.svg?raw"
import draft from "./pull-request-draft.svg?raw"
import pencil from "@phosphor-icons/core/assets/bold/pencil-simple-bold.svg?raw"
import { SessionMark } from "../../src/modules/session/ui/session-mark.tsx"
import "../../src/core/components/list-row/list-row.css"
import "../../src/modules/tab/ui/tab-bar.css"
import { SESSIONS, TAB_IDS, type Pr, type PrState, type ProtoSession } from "./data.ts"

const RAW = { pullRequest, merge, xCircle, circleDashed, x, check, xBold, warning, external, plus, pencil, draft }
export type SvgName = keyof typeof RAW

export function Svg({ name, size = 14, className }: { name: SvgName; size?: number; className?: string }) {
  return (
    <span
      className={`proto-svg ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: RAW[name] }}
    />
  )
}

export const STATE_ICON: Record<PrState, SvgName> = {
  open: "pullRequest",
  draft: "draft",
  merged: "merge",
  closed: "xCircle",
}

export function CiMark({ ci }: { ci: "failed" | "running" | "passed" | "none" }) {
  if (ci === "none") return null
  if (ci === "running") return <span className="proto-ci-spin" data-ci="running" aria-label="Checks running" />
  return (
    <span className="proto-ci" data-ci={ci} aria-label={ci === "failed" ? "Checks failing" : "Checks passed"}>
      <Svg name={ci === "failed" ? "xBold" : "check"} size={8} />
    </span>
  )
}

export interface Variant {
  readonly Badge: ComponentType<{ prs: ReadonlyArray<Pr>; place: "row" | "tab" }>
  readonly Card: ComponentType<{ session: ProtoSession; prs: ReadonlyArray<Pr>; onRemove: (pr: Pr) => void }>
  readonly cardWidth: number
}

function HoverCard({
  variant,
  session,
  prs,
  onRemove,
  place,
  children,
}: {
  variant: Variant
  session: ProtoSession
  prs: ReadonlyArray<Pr>
  onRemove: (pr: Pr) => void
  place: "row" | "tab"
  children: ReactNode
}) {
  if (prs.length === 0) return children
  const { Card } = variant
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger delay={400} closeDelay={150} render={<div className="proto-trigger" data-place={place} />}>
        {children}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side={place === "row" ? "right" : "bottom"}
          align="start"
          sideOffset={place === "row" ? 10 : 6}
          collisionPadding={8}
        >
          <PreviewCard.Popup className="proto-card" style={{ width: variant.cardWidth }}>
            <Card session={session} prs={prs} onRemove={onRemove} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}

function Mark({ session }: { session: ProtoSession }) {
  return (
    <SessionMark
      status={session.status}
      harness="claude"
      waitingFor={session.status === "waiting" ? "approval" : null}
    />
  )
}

export function Window({ variant }: { variant: Variant }) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState("login")
  const prsOf = (s: ProtoSession) => s.prs.filter((pr) => !removed.has(`${s.id}#${pr.repo}#${pr.number}`))
  const remove = (s: ProtoSession) => (pr: Pr) =>
    setRemoved((prev) => new Set(prev).add(`${s.id}#${pr.repo}#${pr.number}`))
  const { Badge } = variant
  const tabs = TAB_IDS.map((id) => SESSIONS.find((s) => s.id === id)!)

  return (
    <div className="proto-window">
      <aside className="proto-sidebar">
        <div className="proto-sidebar-top" />
        <div className="proto-section-label">
          Sessions <span className="proto-count">{SESSIONS.length}</span>
        </div>
        <ul className="proto-list">
          {SESSIONS.map((s) => {
            const prs = prsOf(s)
            return (
              <li key={s.id}>
                <HoverCard variant={variant} session={s} prs={prs} onRemove={remove(s)} place="row">
                  <div
                    className="iv-list-row"
                    data-selected={selected === s.id || undefined}
                    data-attention={s.status === "waiting" || undefined}
                  >
                    <div className="iv-list-row__line">
                      <button type="button" className="iv-list-row__main" onClick={() => setSelected(s.id)}>
                        <span className="iv-list-row__leading">
                          <Mark session={s} />
                        </span>
                        <span className="iv-list-row__title">{s.title}</span>
                        {prs.length > 0 && <Badge prs={prs} place="row" />}
                        <span className="iv-list-row__meta">{s.time}</span>
                      </button>
                    </div>
                  </div>
                </HoverCard>
              </li>
            )
          })}
        </ul>
      </aside>
      <div className="proto-main">
        <div className="proto-topbar">
          <div className="iv-tab-bar">
            <div className="iv-tab-bar__list" role="tablist">
              {tabs.map((s) => {
                const prs = prsOf(s)
                return (
                  <HoverCard key={s.id} variant={variant} session={s} prs={prs} onRemove={remove(s)} place="tab">
                    <div className="iv-tab-bar__item" data-selected={selected === s.id || undefined}>
                      <button
                        type="button"
                        role="tab"
                        className="iv-tab-bar__tab"
                        aria-selected={selected === s.id}
                        onClick={() => setSelected(s.id)}
                      >
                        <Mark session={s} />
                        <span className="iv-tab-bar__title">{s.title}</span>
                        {prs.length > 0 && <Badge prs={prs} place="tab" />}
                      </button>
                      <button type="button" className="iv-tab-bar__close" aria-label="Close tab">
                        <Svg name="x" size={12} />
                      </button>
                    </div>
                  </HoverCard>
                )
              })}
            </div>
            <button type="button" className="proto-new-tab" aria-label="New session">
              <Svg name="plus" size={14} />
            </button>
          </div>
        </div>
        <div className="proto-chat" aria-hidden>
          <div className="proto-bubble">Fix the redirect: after the OAuth callback the user lands on / instead of the page they came from.</div>
          {[92, 100, 74, 88, 40].map((w, i) => (
            <div key={i} className="proto-ghost" style={{ width: `${w}%` }} />
          ))}
          <div className="proto-hint">Hover a session row or a tab that has a pull request.</div>
        </div>
      </div>
    </div>
  )
}
