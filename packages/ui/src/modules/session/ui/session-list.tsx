import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { DateTime } from "effect"
import { useState } from "react"
import { createSessionAtom } from "../atoms/create-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { renameSessionAtom } from "../atoms/rename-session.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })

function SessionRow({ projectPath, id }: { projectPath: string; id: string }) {
  const session = useAtomValue(sessionsOf(projectPath).item(id))
  const [selectedId, select] = useAtom(selectedSessionIdAtom)
  const renameSession = useAtomSet(renameSessionAtom)
  const [draft, setDraft] = useState<string | null>(null)
  if (!session) return null

  const commit = () => {
    const title = draft?.trim()
    if (title && title !== session.title) {
      renameSession({ projectPath, sessionId: id, title })
    }
    setDraft(null)
  }

  return (
    <li data-testid="session-item">
      {draft === null ? (
        <>
          <button
            type="button"
            aria-current={selectedId === id}
            onClick={() => select(id)}
            style={{ textAlign: "left" }}
          >
            <span data-testid="session-title">{session.title || "Untitled session"}</span>{" "}
            <time dateTime={DateTime.formatIso(session.lastActivityAt)}>
              {formatter.format(DateTime.toEpochMillis(session.lastActivityAt))}
            </time>
          </button>
          <button type="button" onClick={() => setDraft(session.title)}>
            Rename
          </button>
        </>
      ) : (
        <input
          aria-label="Session title"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
            if (event.key === "Escape") setDraft(null)
          }}
        />
      )}
    </li>
  )
}

export function SessionList({ projectPath }: { projectPath: string }) {
  const sessions = sessionsOf(projectPath)
  const ids = useAtomValue(sessions.ids)
  const [created, createSession] = useAtom(createSessionAtom)

  return (
    <nav aria-label="Sessions">
      <button type="button" onClick={() => createSession(projectPath)}>
        New session
      </button>
      {AsyncResult.isFailure(created) && <p role="alert">Could not create the session</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {ids.map((id) => (
          <SessionRow key={id} projectPath={projectPath} id={id} />
        ))}
      </ul>
    </nav>
  )
}
