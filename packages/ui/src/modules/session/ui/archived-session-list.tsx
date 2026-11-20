import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useRef, type KeyboardEvent } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { ListRow } from "../../../core/components/list-row/list-row.tsx"
import { isMac } from "../../keybinding/adapters/platform.ts"
import { formatKey } from "../../keybinding/rules/key.ts"
import { archivedSessionsOf } from "../atoms/list-archived-sessions.ts"
import { restoreSessionAtom } from "../atoms/restore-session.ts"
import { sessionActionFailureOf } from "../atoms/session-action-failure.ts"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { useRequestSessionAction } from "../hooks/use-session-actions.ts"
import { RelativeTime } from "./relative-time.tsx"
import { SessionLocation } from "./session-location.tsx"
import { SessionMark } from "./session-mark.tsx"
import "./archived-session-list.css"

function ArchivedRow({ session }: { session: Session }) {
  const restore = useAtomSet(restoreSessionAtom)
  const request = useRequestSessionAction()
  const failure = useAtomValue(sessionActionFailureOf(session.id))
  const location = useSessionLocation(session)
  const target = { projectPath: session.projectPath, sessionId: session.id }
  return (
    <li data-session-id={session.id}>
      <ListRow
        data-testid="archived-session"
        leading={<SessionMark status="idle" harness={session.harness} />}
        title={session.title}
        {...(location.kind !== "folder" && {
          subtitle: <SessionLocation location={location} compact />,
        })}
        meta={session.archivedAt === null ? undefined : <RelativeTime at={session.archivedAt} />}
        actions={
          <>
            <IconButton
              icon="restore"
              label={`Restore ${session.title}`}
              tooltip="Restore"
              size="sm"
              onClick={() => restore(target)}
            />
            <IconButton
              icon="trash"
              label={`Delete ${session.title}`}
              tooltip="Delete"
              size="sm"
              onClick={() => request("delete", session)}
            />
          </>
        }
        {...(failure !== null && { below: <ErrorMessage message={failure} /> })}
      />
    </li>
  )
}

const rowButtons = (list: HTMLElement) => [
  ...list.querySelectorAll<HTMLButtonElement>(".iv-list-row__main"),
]

export function ArchivedSessionList({
  projectPath,
  projectName,
  onBack,
}: {
  projectPath: string
  projectName: string
  onBack: () => void
}) {
  const result = useAtomValue(archivedSessionsOf(projectPath))
  useAtomMount(archivedSessionsOf(projectPath))
  const sessions = AsyncResult.getOrElse(result, () => [] as ReadonlyArray<Session>)
  const loaded = !AsyncResult.isInitial(result)
  const restore = useAtomSet(restoreSessionAtom)
  const request = useRequestSessionAction()
  const view = useRef<HTMLElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const focused = useRef(0)
  const mac = isMac()

  const ids = sessions.map((session) => session.id).join(" ")
  // Keeps the keyboard in the view as rows leave it.
  useEffect(() => {
    if (!loaded) return
    const buttons = list.current ? rowButtons(list.current) : []
    const target =
      buttons[Math.min(focused.current, buttons.length - 1)] ??
      view.current?.querySelector<HTMLButtonElement>(".iv-archived-session-list__head button")
    target?.focus()
  }, [ids, loaded])

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = rowButtons(event.currentTarget)
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const session = sessions[index]
    focused.current = index
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const next = buttons[index + (event.key === "ArrowDown" ? 1 : -1)]
      if (next) {
        focused.current = buttons.indexOf(next)
        next.focus()
      }
    } else if (event.key === "Enter" && session) {
      event.preventDefault()
      restore({ projectPath, sessionId: session.id })
    } else if (event.key === "Backspace" && (mac ? event.metaKey : event.ctrlKey) && session) {
      event.preventDefault()
      request("delete", session)
    }
  }

  return (
    <nav
      ref={view}
      className="iv-archived-session-list"
      aria-label="Archived sessions"
      // Before the focused button's tooltip, which would keep Escape for itself.
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        onBack()
      }}
    >
      <div className="iv-archived-session-list__head">
        <IconButton icon="arrow-left" label="Back to sessions" size="sm" onClick={onBack} />
        <h1 className="iv-archived-session-list__title">Archived sessions</h1>
        {loaded && <span className="iv-archived-session-list__count">{sessions.length}</span>}
      </div>
      <div className="iv-archived-session-list__scroll">
        {loaded && sessions.length === 0 ? (
          <div className="iv-archived-session-list__empty">
            <p>No archived sessions in {projectName}.</p>
            <p>Archive a session from its menu to hide it from the sidebar.</p>
          </div>
        ) : (
          <ul className="iv-archived-session-list__rows" ref={list} onKeyDown={onKeyDown}>
            {sessions.map((session) => (
              <ArchivedRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </div>
      {sessions.length > 0 && (
        <div className="iv-archived-session-list__keys" aria-hidden="true">
          <span>
            <kbd>↵</kbd>Restore
          </span>
          <span>
            <kbd>{formatKey("mod+backspace", { mac })}</kbd>Delete
          </span>
          <span>
            <kbd>esc</kbd>Back
          </span>
        </div>
      )}
    </nav>
  )
}
