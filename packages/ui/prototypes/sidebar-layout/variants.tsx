import { useLayoutEffect, useRef } from "react"
import { IconButton } from "../../src/core/components/button/button.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { Tooltip } from "../../src/core/components/tooltip/tooltip.tsx"
import { ProjectCreature } from "../../src/modules/project/ui/project-creature.tsx"
import { projectLabel, waitingCount } from "./data.ts"
import {
  App,
  Card,
  Connection,
  NewSession,
  ProjectActions,
  ProjectButton,
  ProjectMenu,
  SettingsButton,
  ShellControls,
  SidebarTabs,
  WorkingPanel,
  useConnected,
  useShell,
  type Shell,
} from "./shared.tsx"

function ColumnHead({ shell }: { shell: Shell }) {
  return (
    <div className="iv-project-column__head">
      <ProjectCreature name={shell.project.name} size={16} />
      <h1 className="iv-project-column__name">{shell.project.name}</h1>
      <NewSession />
      <ProjectActions />
    </div>
  )
}

function SelectHead({ shell, others }: { shell: Shell; others?: boolean }) {
  const elsewhere = shell.projects.reduce(
    (n, p, i) => (i === shell.index ? n : n + waitingCount(p)),
    0,
  )
  return (
    <div className="iv-project-column__head proto-select-head">
      <ProjectMenu
        shell={shell}
        trigger={
          <button type="button" className="proto-select" aria-label={`Project: ${shell.project.name}`}>
            <ProjectCreature name={shell.project.name} size={16} />
            <span className="proto-select__name">{shell.project.name}</span>
            <Icon name="chevron-down" size={14} />
            {others === true && elsewhere > 0 && (
              <span className="proto-elsewhere" aria-label={`${elsewhere} waiting in other projects`}>
                {elsewhere}
              </span>
            )}
          </button>
        }
      />
      <NewSession />
      <ProjectActions />
    </div>
  )
}

function Column({ shell }: { shell: Shell }) {
  return (
    <div className="iv-project-column">
      {shell.project && <ColumnHead shell={shell} />}
      <SidebarTabs shell={shell} />
    </div>
  )
}

export function Rail() {
  const shell = useShell()
  return (
    <App
      shell={shell}
      card={
        <Card>
          <div className="iv-app__card-body">
            <nav className="iv-project-rail" aria-label="Projects">
              {shell.projects.map((p, i) => (
                <ProjectButton key={p.name} shell={shell} i={i} />
              ))}
              <IconButton icon="plus" label="Open folder…" size="sm" />
              <span className="iv-project-rail__spacer" />
              <SettingsButton />
              <Connection />
            </nav>
            <Column shell={shell} />
          </div>
          <WorkingPanel shell={shell} />
        </Card>
      }
    />
  )
}

interface StripOptions {
  // Where the Settings button and the connection dot go.
  readonly settings: "top" | "end"
  readonly badge: "count" | "dot"
  readonly size: "md" | "sm"
  readonly arrows: boolean
}

function GearWithStatus() {
  const on = useConnected()
  return (
    <span className="proto-gear">
      <SettingsButton />
      {!on && <span className="proto-gear__dot" aria-hidden="true" />}
    </span>
  )
}

function StripProject({ shell, i, o }: { shell: Shell; i: number; o: StripOptions }) {
  const p = shell.projects[i]!
  const w = waitingCount(p)
  return (
    <div className="iv-project-rail__item" data-project-index={i}>
      <Tooltip side="top" content={projectLabel(p)}>
        <button
          type="button"
          className="iv-project-rail__project proto-strip__project"
          data-size={o.size}
          aria-label={projectLabel(p)}
          aria-current={i === shell.index}
          onClick={() => shell.select(i)}
        >
          <ProjectCreature name={p.name} size={o.size === "sm" ? 12 : 16} />
        </button>
      </Tooltip>
      {w > 0 &&
        (o.badge === "dot" ? (
          <span className="proto-badge-dot" aria-hidden="true" />
        ) : (
          <span className="proto-badge-sm" aria-hidden="true">
            {w}
          </span>
        ))}
    </div>
  )
}

function StripLayout(o: StripOptions) {
  const shell = useShell()
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = scroller.current
    const on = box?.querySelector<HTMLElement>(`[data-project-index="${shell.index}"]`)
    if (!box || !on) return
    const r = on.getBoundingClientRect()
    const c = box.getBoundingClientRect()
    const d = r.left < c.left ? r.left - c.left - 8 : r.right > c.right ? r.right - c.right + 8 : 0
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (d !== 0) box.scrollBy({ left: d, behavior: reduce ? "auto" : "smooth" })
  }, [shell.index])
  const top =
    o.settings === "top" ? (
      <ShellControls
        extra={
          <span className="proto-top-extra">
            <GearWithStatus />
          </span>
        }
      />
    ) : undefined
  return (
    <App
      shell={shell}
      card={
        <Card top={top}>
          <div className="iv-project-column proto-fill">
            <SelectHead shell={shell} />
            <SidebarTabs shell={shell} />
          </div>
          <WorkingPanel shell={shell} />
          <div className="proto-strip" data-size={o.size}>
            {o.arrows && (
              <IconButton
                icon="arrow-left"
                label="Previous project"
                tooltip="Previous project ⌃⌘["
                size="sm"
                disabled={shell.index === 0}
                onClick={() => shell.step(-1)}
              />
            )}
            <div className="proto-strip__scroll" ref={scroller} role="group" aria-label="Projects">
              {shell.projects.map((p, i) => (
                <StripProject key={p.name} shell={shell} i={i} o={o} />
              ))}
              <IconButton icon="plus" label="Open folder…" size="sm" />
            </div>
            {o.arrows && (
              <IconButton
                icon="arrow-right"
                label="Next project"
                tooltip="Next project ⌃⌘]"
                size="sm"
                disabled={shell.index === shell.projects.length - 1}
                onClick={() => shell.step(1)}
              />
            )}
            {o.settings === "end" && <GearWithStatus />}
          </div>
        </Card>
      }
    />
  )
}

export const GearOnTop = () => <StripLayout settings="top" badge="count" size="md" arrows />
export const GearAtEnd = () => <StripLayout settings="end" badge="count" size="sm" arrows={false} />
export const DotBadges = () => <StripLayout settings="top" badge="dot" size="sm" arrows={false} />
export const Mix = () => <StripLayout settings="top" badge="dot" size="md" arrows />
