import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { DateTime } from "effect"
import { useState } from "react"
import { Button, IconButton } from "../../../core/ui/button/button.tsx"
import { ListRow } from "../../../core/ui/list-row/list-row.tsx"
import { Menu } from "../../../core/ui/menu/menu.tsx"
import { Select } from "../../../core/ui/select/select.tsx"
import { StatusMark } from "../../../core/ui/status-mark/status-mark.tsx"
import { Text } from "../../../core/ui/text/text.tsx"
import { TextField } from "../../../core/ui/text-field/text-field.tsx"
import { createSessionAtom } from "../atoms/create-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useNow } from "../hooks/use-now.ts"
import { DEFAULT_MODEL, MODELS, type Model } from "../rules/models.ts"
import { relativeTime } from "../rules/relative-time.ts"
import { statusLabel } from "../rules/status-label.ts"
import { renameSessionAtom } from "../atoms/rename-session.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import "./session-list.css"

function SessionRow({ projectPath, id }: { projectPath: string; id: string }) {
  const session = useAtomValue(sessionsOf(projectPath).item(id))
  const [selectedId, select] = useAtom(selectedSessionIdAtom)
  const renameSession = useAtomSet(renameSessionAtom)
  const [draft, setDraft] = useState<string | null>(null)
  const now = useNow()
  if (!session) return null

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

  const label = statusLabel(session.status)
  return (
    <li>
      <ListRow
        data-testid="session-item"
        selected={selectedId === id}
        aria-current={selectedId === id}
        onSelect={() => select(id)}
        leading={
          <span data-testid="session-status">
            <StatusMark status={session.status} label={label} />
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

export function SessionList({ projectPath }: { projectPath: string }) {
  const sessions = sessionsOf(projectPath)
  const ids = useAtomValue(sessions.ids)
  const [created, createSession] = useAtom(createSessionAtom)
  const [model, setModel] = useState<Model>(DEFAULT_MODEL)

  return (
    <nav className="iv-session-list" aria-label="Sessions">
      <div className="iv-session-list__toolbar">
        <Button icon="plus" onClick={() => createSession({ projectPath, model })}>
          New session
        </Button>
        <Select
          label="Model"
          value={model}
          onChange={(value) => setModel(value as Model)}
          options={MODELS.map((name) => ({ value: name, label: name }))}
        />
      </div>
      {AsyncResult.isFailure(created) && (
        <Text role="alert" tone="danger">
          Could not create the session
        </Text>
      )}
      <ul className="iv-session-list__rows">
        {ids.map((id) => (
          <SessionRow key={id} projectPath={projectPath} id={id} />
        ))}
      </ul>
    </nav>
  )
}
