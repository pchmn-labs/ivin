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
import { ProjectCreature } from "../../project/ui/project-creature.tsx"
import { useNow } from "../../../shared/use-now.ts"
import { groupSessions } from "../rules/group-sessions.ts"
import { DEFAULT_MODEL, MODELS, type Model } from "../rules/models.ts"
import { relativeTime } from "../rules/relative-time.ts"
import { statusLabel } from "../rules/status-label.ts"
import { renameSessionAtom } from "../atoms/rename-session.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { SessionMark } from "./session-mark.tsx"
import "./session-list.css"

function SessionRow({ projectPath, session }: { projectPath: string; session: Session }) {
  const { id } = session
  const [selectedId, select] = useAtom(selectedSessionIdAtom)
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
        selected={selectedId === id}
        attention={session.status === "waiting"}
        aria-current={selectedId === id}
        onSelect={() => select(id)}
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
  needsYou = false,
}: {
  label: string
  sessions: ReadonlyArray<Session>
  projectPath: string
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
          <SessionRow key={session.id} projectPath={projectPath} session={session} />
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
  const [created, createSession] = useAtom(createSessionAtom)
  const [model, setModel] = useState<Model>(DEFAULT_MODEL)
  const { needsYou, others } = groupSessions(sessions)

  return (
    <nav className="iv-session-list" aria-label="Sessions">
      <div className="iv-session-list__head">
        <ProjectCreature name={projectName} size={16} />
        <h1 className="iv-session-list__project" data-testid="project-name" title={projectPath}>
          {projectName}
        </h1>
        <span className="iv-session-list__new">
          <IconButton
            icon="new-session"
            label="New session"
            tooltip={`New session · ${model}`}
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
      <div className="iv-session-list__scroll">
        <Group label="Needs you" sessions={needsYou} projectPath={projectPath} needsYou />
        <Group label="Sessions" sessions={others} projectPath={projectPath} />
      </div>
    </nav>
  )
}
