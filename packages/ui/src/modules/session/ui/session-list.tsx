import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useState } from "react"
import type { Session } from "@ivin/contracts/session"
import { Slot } from "../../../app/slot-renderer.tsx"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ListRow } from "../../../core/components/list-row/list-row.tsx"
import { ListSection } from "../../../core/components/list-section/list-section.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { renameSessionAtom } from "../atoms/rename-session.ts"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { RelativeTime } from "./relative-time.tsx"
import { SessionLocation } from "./session-location.tsx"
import { useSessionLocation } from "../hooks/use-session-location.ts"
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
  const location = useSessionLocation(session)

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
            <SessionMark status={session.status} />
          </span>
        }
        title={<span data-testid="session-title">{session.title}</span>}
        {...(location.kind !== "folder" && {
          subtitle: <SessionLocation location={location} compact />,
        })}
        meta={<RelativeTime at={session.lastActivityAt} />}
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
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const open = tabs.flatMap((tab) => byId.get(tab.sessionId) ?? [])

  return (
    <nav className="iv-session-list" aria-label="Sessions">
      {tabsLoaded && tabs.length === 0 && (
        <p className="iv-session-list__empty">
          {sessions.length === 0
            ? `No sessions in ${projectName} yet. Start one with New session.`
            : "No session open. Start one with New session."}
        </p>
      )}
      <div className="iv-session-list__scroll">
        {open.length > 0 && (
          <ListSection label="Sessions" count={open.length}>
            {open.map((session) => (
              <SessionRow
                key={session.id}
                projectPath={projectPath}
                session={session}
                selected={session.id === selectedSessionId}
              />
            ))}
          </ListSection>
        )}
        <Slot slot="sidebar.section" props={{}} />
      </div>
    </nav>
  )
}
