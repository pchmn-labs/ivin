import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { DateTime } from "effect"
import { useState } from "react"
import type { Session } from "@ivin/contracts/session"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ListRow } from "../../../core/components/list-row/list-row.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { createSessionAtom } from "../atoms/create-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useNow } from "../../../shared/use-now.ts"
import { groupSessions } from "../rules/group-sessions.ts"
import { relativeTime } from "../rules/relative-time.ts"
import { statusLabel } from "../rules/status-label.ts"
import { renameSessionAtom } from "../atoms/rename-session.ts"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { SessionMark } from "./session-mark.tsx"
import "./session-list.css"

function SessionRow({
  projectPath,
  session,
  selected,
}: {
  projectPath: string
  session: Session
  selected: boolean
}) {
  const { id } = session
  const openTab = useAtomSet(openTabAtom)
  const renameSession = useAtomSet(renameSessionAtom)
  const [draft, setDraft] = useState<string | null>(null)
  const now = useNow()

  const commit = () => {
    const title = draft?.trim()
    if (title && title !== session.title) {
      renameSession({ projectPath, sessionId: id, title })
    }
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <li data-testid="session-item" className="iv-session-list__edit">
        <TextField
          label="Session title"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
            if (event.key === "Escape") {
              event.preventDefault()
              setDraft(null)
            }
          }}
        />
      </li>
    )
  }

  return (
    <li>
      <ListRow
        data-testid="session-item"
        selected={selected}
        attention={session.status === "waiting"}
        aria-current={selected}
        onSelect={() => openTab({ sessionId: id })}
        leading={
          <span data-testid="session-status">
            <SessionMark status={session.status} label={statusLabel(session.status)} />
          </span>
        }
        title={<span data-testid="session-title">{session.title}</span>}
        meta={
          <time dateTime={DateTime.formatIso(session.lastActivityAt)}>
            {relativeTime(DateTime.toEpochMillis(session.lastActivityAt), now)}
          </time>
        }
        actions={
          <Menu
            align="end"
            trigger={<IconButton icon="ellipsis" label="Session actions" size="sm" />}
            items={[{ label: "Rename", icon: "pencil", onSelect: () => setDraft(session.title) }]}
          />
        }
      />
    </li>
  )
}

function Group({
  label,
  sessions,
  projectPath,
  selectedId,
  needsYou = false,
}: {
  label: string
  sessions: ReadonlyArray<Session>
  projectPath: string
  selectedId: string | null
  needsYou?: boolean
}) {
  if (sessions.length === 0) return null
  return (
    <section className="iv-session-list__group" aria-label={label}>
      <h2 className="iv-session-list__label" data-needs-you={needsYou || undefined}>
        {label} <span className="iv-session-list__count">{sessions.length}</span>
      </h2>
      <ul className="iv-session-list__rows">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            projectPath={projectPath}
            session={session}
            selected={session.id === selectedId}
          />
        ))}
      </ul>
    </section>
  )
}

export function SessionList({
  projectPath,
  projectName,
}: {
  projectPath: string
  projectName: string
}) {
  const list = sessionsOf(projectPath)
  useAtomMount(list.ids)
  const sessions = useAtomValue(list.items)
  const tabsState = tabsOf(projectPath)
  const { tabs, selectedSessionId } = useAtomValue(tabsState.value)
  const tabsLoaded = useAtomValue(tabsState.loaded)
  const created = useAtomValue(createSessionAtom)
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const open = tabs.flatMap((tab) => byId.get(tab.sessionId) ?? [])
  const { needsYou, others } = groupSessions(open)

  return (
    <nav className="iv-session-list" aria-label="Sessions">
      {AsyncResult.isFailure(created) && (
        <Text role="alert" tone="danger">
          Could not create the session
        </Text>
      )}
      {tabsLoaded && tabs.length === 0 && (
        <p className="iv-session-list__empty">
          {sessions.length === 0
            ? `No sessions in ${projectName} yet. Start one with New session.`
            : "No session open. Start one with New session."}
        </p>
      )}
      <div className="iv-session-list__scroll">
        <Group
          label="Needs you"
          sessions={needsYou}
          projectPath={projectPath}
          selectedId={selectedSessionId}
          needsYou
        />
        <Group
          label="Sessions"
          sessions={others}
          projectPath={projectPath}
          selectedId={selectedSessionId}
        />
      </div>
    </nav>
  )
}
