import { Menu as BaseMenu } from "@base-ui/react/menu"
import { useEffect, useState, type ReactElement, type ReactNode } from "react"
import { Button, IconButton } from "../../src/core/components/button/button.tsx"
import { Disclosure } from "../../src/core/components/disclosure/disclosure.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { ListRow } from "../../src/core/components/list-row/list-row.tsx"
import { ListSection } from "../../src/core/components/list-section/list-section.tsx"
import { Menu } from "../../src/core/components/menu/menu.tsx"
import { Stack } from "../../src/core/components/stack/stack.tsx"
import { Tabs } from "../../src/core/components/tabs/tabs.tsx"
import { Text } from "../../src/core/components/text/text.tsx"
import { Tooltip } from "../../src/core/components/tooltip/tooltip.tsx"
import { ProjectCreature } from "../../src/modules/project/ui/project-creature.tsx"
import { SessionMark } from "../../src/modules/session/ui/session-mark.tsx"
import { PROJECTS, projectLabel, waitingCount, type FakeProject, type FakeSession } from "./data.ts"
import "../../src/app/app.css"
import "../../src/app/shell-controls.css"
import "../../src/app/sidebar-tabs.css"
import "../../src/modules/project/ui/project-column.css"
import "../../src/modules/project/ui/project-rail.css"
import "../../src/modules/session/ui/session-list.css"
import "../../src/modules/session/ui/session-location.css"
import "../../src/core/components/menu/menu.css"

export interface Shell {
  readonly projects: ReadonlyArray<FakeProject>
  readonly index: number
  readonly project: FakeProject
  readonly select: (i: number) => void
  readonly step: (d: 1 | -1) => void
  readonly sessionId: string | null
  readonly openSession: (projectIndex: number, id: string) => void
}

export function useShell(): Shell {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<number, string>>({})
  const project = PROJECTS[index]!
  const select = (i: number) => setIndex(Math.max(0, Math.min(PROJECTS.length - 1, i)))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey && e.ctrlKey)) return
      if (e.key === "]" || e.key === "ArrowDown") (e.preventDefault(), setIndex((i) => Math.min(PROJECTS.length - 1, i + 1)))
      if (e.key === "[" || e.key === "ArrowUp") (e.preventDefault(), setIndex((i) => Math.max(0, i - 1)))
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
  return {
    projects: PROJECTS,
    index,
    project,
    select,
    step: (d) => select(index + d),
    sessionId: picked[index] ?? project.sessions[0]?.id ?? null,
    openSession: (projectIndex, id) => {
      setIndex(projectIndex)
      setPicked((p) => ({ ...p, [projectIndex]: id }))
    },
  }
}

export function ShellControls({ extra }: { extra?: ReactNode }) {
  return (
    <div className="iv-shell-controls" data-sidebar="open">
      <span className="iv-shell-controls__lights" aria-hidden="true" />
      <IconButton icon="panel-left" label="Toggle sidebar" tooltip="Toggle sidebar ⌘B" size="sm" />
      {extra}
      <IconButton icon="arrow-left" label="Back" size="sm" />
      <IconButton icon="arrow-right" label="Forward" size="sm" disabled />
    </div>
  )
}

export const Connection = () => (
  <Tooltip content="Connected to the server">
    <span className="iv-connection" data-state="connected" tabIndex={-1} />
  </Tooltip>
)

export const SettingsButton = () => (
  <IconButton icon="gear" label="Settings" tooltip="Settings ⌘," size="sm" />
)

export function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="iv-project-rail__badge" aria-hidden="true">
      {count}
    </span>
  )
}

export function ProjectButton({
  shell,
  i,
  size = 20,
  side = "right",
  className = "iv-project-rail__project",
}: {
  shell: Shell
  i: number
  size?: 16 | 20
  side?: "right" | "top" | "bottom"
  className?: string
}) {
  const p = shell.projects[i]!
  return (
    <div className="iv-project-rail__item" data-project-index={i}>
      <Tooltip side={side} content={projectLabel(p)}>
        <button
          type="button"
          className={className}
          aria-label={projectLabel(p)}
          aria-current={i === shell.index}
          onClick={() => shell.select(i)}
        >
          <ProjectCreature name={p.name} size={size} />
        </button>
      </Tooltip>
      <Badge count={waitingCount(p)} />
    </div>
  )
}

export function ProjectActions() {
  return (
    <Menu
      align="end"
      trigger={<IconButton icon="ellipsis" label="Project actions" size="sm" />}
      items={[
        { label: "Archived sessions", icon: "archive", hint: "⇧⌘A", onSelect: () => {} },
        "separator",
        { label: "Close project", icon: "x", onSelect: () => {} },
      ]}
    />
  )
}

export const NewSession = () => (
  <IconButton icon="new-session" label="New session" tooltip="New session ⌘N" size="md" />
)

// The project list as a menu: creature, name, waiting count, the selected one checked.
export function ProjectMenu({ shell, trigger }: { shell: Shell; trigger: ReactElement }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner align="start" sideOffset={4}>
          <BaseMenu.Popup className="iv-menu proto-project-menu">
            <BaseMenu.RadioGroup value={shell.index}>
              {shell.projects.map((p, i) => {
                const w = waitingCount(p)
                return (
                  <BaseMenu.RadioItem
                    key={p.name}
                    value={i}
                    closeOnClick
                    className="iv-menu__item"
                    onClick={() => shell.select(i)}
                  >
                    <ProjectCreature name={p.name} size={16} />
                    <span className="iv-menu__label">{p.name}</span>
                    {w > 0 && <span className="proto-count">{w}</span>}
                    <span className="iv-menu__check">
                      {i === shell.index ? <Icon name="check" size={14} /> : null}
                    </span>
                  </BaseMenu.RadioItem>
                )
              })}
            </BaseMenu.RadioGroup>
            <BaseMenu.Separator className="iv-menu__separator" />
            <BaseMenu.Item className="iv-menu__item">
              <Icon name="plus" size={14} />
              <span className="iv-menu__label">Open folder…</span>
              <span className="iv-menu__hint">⌘O</span>
            </BaseMenu.Item>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

function Location({ s }: { s: FakeSession }) {
  return (
    <span className="iv-session-location" data-compact>
      <span className="iv-session-location__item">
        <Icon name={s.kind === "worktree" ? "worktree" : "folder"} size={12} />
        <span className="iv-session-location__name iv-session-location__branch">{s.branch}</span>
      </span>
    </span>
  )
}

const FILES = ["apps/", "packages/", "plugins/", "AGENTS.md", "DESIGN.md", "package.json", "pnpm-lock.yaml"]
const CHANGES = ["packages/ui/src/app/app.tsx", "packages/ui/src/app/app.css", "DESIGN.md"]

function FileRows({ names }: { names: ReadonlyArray<string> }) {
  return (
    <ul className="proto-files">
      {names.map((f) => (
        <li key={f}>
          <Icon name={f.endsWith("/") ? "folder" : "file"} size={14} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  )
}

export function SidebarTabs({ shell }: { shell: Shell }) {
  const [tab, setTab] = useState("sessions")
  const { project } = shell
  return (
    <Tabs
      aria-label="Sidebar"
      tabs={[
        { value: "sessions", label: "Sessions" },
        { value: "files", label: "Files" },
        { value: "changes", label: "Changes", badge: <span className="proto-tab-badge">3</span> },
      ]}
      value={tab}
      onValueChange={setTab}
    >
      {tab === "sessions" ? (
        <div className="iv-sidebar-tabs__sessions">
          <nav className="iv-session-list" aria-label="Sessions">
            {project.sessions.length === 0 && (
              <p className="iv-session-list__empty">
                No sessions in {project.name} yet. Start one with New session.
              </p>
            )}
            <div className="iv-session-list__scroll">
              {project.sessions.length > 0 && (
                <ListSection label="Sessions" count={project.sessions.length}>
                  {project.sessions.map((s) => (
                    <li key={s.id}>
                      <ListRow
                        selected={s.id === shell.sessionId}
                        attention={s.status === "waiting"}
                        aria-current={s.id === shell.sessionId}
                        onSelect={() => shell.openSession(shell.index, s.id)}
                        leading={<SessionMark status={s.status} harness="claude" waitingFor={s.waitingFor ?? null} />}
                        title={s.title}
                        subtitle={<Location s={s} />}
                        meta={<span className="proto-meta">{s.ago}</span>}
                        actions={<IconButton icon="ellipsis" label="Session actions" size="sm" />}
                      />
                    </li>
                  ))}
                </ListSection>
              )}
            </div>
          </nav>
        </div>
      ) : (
        <div className="iv-sidebar-tabs__panel">
          <FileRows names={tab === "files" ? FILES : CHANGES} />
        </div>
      )}
    </Tabs>
  )
}

export function WorkingPanel({ shell }: { shell: Shell }) {
  const rows = shell.projects.flatMap((p, pi) =>
    p.sessions
      .filter((s) => (s.status === "waiting" || s.status === "working") && s.id !== shell.sessionId)
      .map((s) => ({ s, p, pi })),
  )
  const needs = rows.filter((r) => r.s.status === "waiting")
  const running = rows.filter((r) => r.s.status === "working")
  if (rows.length === 0) return null
  const row = ({ s, p, pi }: (typeof rows)[number]) => (
    <Stack as="li" key={s.id}>
      <ListRow
        attention={s.status === "waiting"}
        onSelect={() => shell.openSession(pi, s.id)}
        leading={<SessionMark status={s.status} harness="claude" waitingFor={s.waitingFor ?? null} />}
        title={s.title}
        meta={<span className="proto-meta">{s.ago}</span>}
        subtitle={
          <Stack as="span" direction="row" gap={1} align="center">
            <ProjectCreature name={p.name} size={12} />
            <span className="proto-nowrap"><Text size="xs" tone="faint">{p.name}</Text></span>
            {s.command !== undefined && (
              <Text size="xs" tone="muted" mono truncate>
                {s.command}
              </Text>
            )}
          </Stack>
        }
        {...(s.waitingFor === "approval" && {
          below: (
            <Stack direction="row" gap={1}>
              <Button size="sm" variant="secondary">Allow</Button>
              <Button size="sm" variant="ghost">Deny</Button>
            </Stack>
          ),
        })}
      />
    </Stack>
  )
  return (
    <div className="iv-app__bottom proto-bottom">
      <div className="iv-app__bottom-scroll">
        <Disclosure
          variant="panel"
          defaultOpen
          summary={
            <span>
              Working · {rows.length}
              {needs.length > 0 && <span className="proto-attention"> · {needs.length} need you</span>}
            </span>
          }
        >
          {needs.length > 0 && <ListSection label="Needs you" attention>{needs.map(row)}</ListSection>}
          {running.length > 0 && <ListSection label="Running">{running.map(row)}</ListSection>}
        </Disclosure>
      </div>
    </div>
  )
}

export function Card({ top, children }: { top?: ReactNode; children: ReactNode }) {
  return (
    <aside className="iv-app__card" aria-label="Projects and sessions">
      <div className="iv-app__card-top">{top ?? <ShellControls />}</div>
      {children}
    </aside>
  )
}

export function Main({ shell }: { shell: Shell }) {
  const s = shell.project.sessions.find((x) => x.id === shell.sessionId)
  return (
    <main className="iv-app__main">
      <div className="proto-titlebar">
        {s && (
          <span className="proto-tab">
            <SessionMark status={s.status} harness="claude" waitingFor={s.waitingFor ?? null} />
            <span className="proto-tab__title">{s.title}</span>
          </span>
        )}
        <IconButton icon="plus" label="New tab" size="sm" />
      </div>
      <div className="proto-chat">
        {s ? (
          <div className="proto-bubble">{s.title}</div>
        ) : (
          <h1 className="proto-empty">What should we work on in {shell.project.name}?</h1>
        )}
      </div>
      <div className="proto-composer">
        <div className="proto-composer__surface">Ask, build, or paste an image…</div>
      </div>
    </main>
  )
}

export function App({ shell, card }: { shell: Shell; card: ReactNode }) {
  return (
    <div className="iv-app">
      {card}
      <Main shell={shell} />
    </div>
  )
}
