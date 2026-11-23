import { useLayoutEffect, useRef } from "react"
import { IconButton } from "../../src/core/components/button/button.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { Tooltip } from "../../src/core/components/tooltip/tooltip.tsx"
import { ProjectCreature } from "../../src/modules/project/ui/project-creature.tsx"
import { waitingCount } from "./data.ts"
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

export function Strip() {
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
  return (
    <App
      shell={shell}
      card={
        <Card>
          <div className="iv-project-column proto-fill">
            <SelectHead shell={shell} />
            <SidebarTabs shell={shell} />
          </div>
          <WorkingPanel shell={shell} />
          <div className="proto-strip">
            <IconButton
              icon="arrow-left"
              label="Previous project"
              tooltip="Previous project ⌃⌘["
              size="sm"
              disabled={shell.index === 0}
              onClick={() => shell.step(-1)}
            />
            <div className="proto-strip__scroll" ref={scroller} role="group" aria-label="Projects">
              {shell.projects.map((p, i) => (
                <ProjectButton key={p.name} shell={shell} i={i} size={16} side="top" className="iv-project-rail__project proto-strip__project" />
              ))}
              <IconButton icon="plus" label="Open folder…" size="sm" />
            </div>
            <IconButton
              icon="arrow-right"
              label="Next project"
              tooltip="Next project ⌃⌘]"
              size="sm"
              disabled={shell.index === shell.projects.length - 1}
              onClick={() => shell.step(1)}
            />
            <span className="proto-divider" aria-hidden="true" />
            <SettingsButton />
            <span className="proto-dot">
              <Connection />
            </span>
          </div>
        </Card>
      }
    />
  )
}

export function Switcher() {
  const shell = useShell()
  return (
    <App
      shell={shell}
      card={
        <Card>
          <div className="iv-project-column proto-fill">
            <SelectHead shell={shell} others />
            <SidebarTabs shell={shell} />
          </div>
          <WorkingPanel shell={shell} />
          <div className="proto-foot">
            <Connection />
            <span className="proto-foot__label">Connected</span>
            <SettingsButton />
          </div>
        </Card>
      }
    />
  )
}

export function TopRow() {
  const shell = useShell()
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    row.current
      ?.querySelector(`[data-project-index="${shell.index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [shell.index])
  return (
    <App
      shell={shell}
      card={
        <Card
          top={
            <ShellControls
              extra={
                <span className="proto-top-extra">
                  <Connection />
                  <SettingsButton />
                </span>
              }
            />
          }
        >
          <div className="iv-project-column proto-fill">
            <div className="proto-toprow">
              <div className="proto-toprow__scroll" ref={row} role="group" aria-label="Projects">
                {shell.projects.map((p, i) => {
                  const on = i === shell.index
                  const w = waitingCount(p)
                  return (
                    <div key={p.name} className="iv-project-rail__item" data-project-index={i}>
                      <Tooltip side="bottom" content={w ? `${p.name} · ${w} waiting for you` : p.name}>
                        <button
                          type="button"
                          className="proto-pill"
                          aria-current={on}
                          aria-label={p.name}
                          onClick={() => shell.select(i)}
                        >
                          <ProjectCreature name={p.name} size={16} />
                          {on && <span className="proto-pill__name">{p.name}</span>}
                        </button>
                      </Tooltip>
                      {w > 0 && (
                        <span className="iv-project-rail__badge" aria-hidden="true">
                          {w}
                        </span>
                      )}
                    </div>
                  )
                })}
                <IconButton icon="plus" label="Open folder…" size="sm" />
              </div>
              <NewSession />
              <ProjectActions />
            </div>
            <SidebarTabs shell={shell} />
          </div>
          <WorkingPanel shell={shell} />
        </Card>
      }
    />
  )
}
