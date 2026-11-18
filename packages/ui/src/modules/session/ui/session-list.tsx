import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
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
import { DEFAULT_MODEL, MODELS, type Model } from "../rules/models.ts"
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

function TabSessionRow({
  projectPath,
  sessionId,
  selected,
}: {
  projectPath: string
  sessionId: string
  selected: boolean
}) {
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  if (!session) return null
  return <SessionRow projectPath={projectPath} session={session} selected={selected} />
}

export function SessionList({ projectPath }: { projectPath: string }) {
  useAtomMount(sessionsOf(projectPath).ids)
  const { tabs, selectedSessionId } = useAtomValue(tabsOf(projectPath).value)
  const [created, createSession] = useAtom(createSessionAtom)
  const [model, setModel] = useState<Model>(DEFAULT_MODEL)

  return (
    <nav className="iv-session-list" aria-label="Sessions">
      <div className="iv-session-list__head">
        <h2 className="iv-session-list__label">Sessions</h2>
        <span className="iv-session-list__new">
          <IconButton
            icon="new-session"
            label="New session"
            tooltip={`New session · ${model}`}
            size="sm"
            onClick={() => createSession({ projectPath, model })}
          />
          <Menu
            align="end"
            trigger={
              <IconButton icon="chevron-down" label="Model for the next session" size="sm" />
            }
            items={MODELS.map((name) => ({
              label: name,
              ...(name === model && { icon: "check" as const }),
              onSelect: () => {
                setModel(name)
                createSession({ projectPath, model: name })
              },
            }))}
          />
        </span>
      </div>
      {AsyncResult.isFailure(created) && (
        <Text role="alert" tone="danger">
          Could not create the session
        </Text>
      )}
      <ul className="iv-session-list__rows">
        {tabs.map((tab) => (
          <TabSessionRow
            key={tab.sessionId}
            projectPath={projectPath}
            sessionId={tab.sessionId}
            selected={tab.sessionId === selectedSessionId}
          />
        ))}
      </ul>
    </nav>
  )
}
