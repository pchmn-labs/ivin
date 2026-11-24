import { useEffect, useState, type ReactNode } from "react"
import type { BackgroundTask, Session } from "@ivin/contracts/session"
import { Button, IconButton } from "../../src/core/components/button/button.tsx"
import { Dialog } from "../../src/core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../src/core/components/error-message/error-message.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { ListRow } from "../../src/core/components/list-row/list-row.tsx"
import { ListSection } from "../../src/core/components/list-section/list-section.tsx"
import { Menu } from "../../src/core/components/menu/menu.tsx"
import { SessionMark } from "../../src/modules/session/ui/session-mark.tsx"
import "../../src/modules/session/ui/session-action-dialog.css"

type Status = Session["status"]

interface Fake {
  readonly id: string
  readonly title: string
  readonly status: Status
  readonly ago: string
  readonly unsaved: ReadonlyArray<string>
  readonly tasks?: ReadonlyArray<BackgroundTask>
  // The prototype makes this one fail, to show a failure among several.
  readonly fails?: boolean
}

const task = (description: string): BackgroundTask => ({
  taskId: description,
  kind: "shell",
  description,
  itemId: "i",
  toolCallId: "t",
  at: Date.now() - 60_000,
})

const OPEN: ReadonlyArray<Fake> = [
  { id: "o1", title: "Group the tabs into named groups", status: "working", ago: "now", unsaved: [] },
  { id: "o2", title: "Show the release notes in the update card", status: "idle", ago: "12 min", unsaved: [] },
]

const INACTIVE: ReadonlyArray<Fake> = [
  { id: "a", title: "Draft the release notes for 0.5", status: "working", ago: "now", unsaved: [] },
  {
    id: "b",
    title: "Add a beta channel to Settings",
    status: "in_background",
    ago: "4 min",
    unsaved: [],
    tasks: [task("pnpm test --watch")],
  },
  {
    id: "c",
    title: "Rename the sidebar tabs",
    status: "idle",
    ago: "2 h",
    unsaved: ["packages/ui/src/app/sidebar-tabs.tsx", "packages/ui/src/app/sidebar-tabs.css"],
  },
  { id: "d", title: "Fix the Changes panel scroll jump", status: "idle", ago: "5 h", unsaved: [] },
  {
    id: "e",
    title: "Investigate the flaky macOS e2e test",
    status: "failed",
    ago: "1 d",
    unsaved: [],
    fails: true,
  },
  { id: "f", title: "Try a lighter dialog backdrop", status: "idle", ago: "3 d", unsaved: [] },
]

type Action = "archive" | "delete"

const isRunning = (s: Fake) =>
  s.status === "working" || s.status === "waiting" || s.status === "in_background"
const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function editedFiles(sessions: ReadonlyArray<Fake>): ReadonlyArray<string> {
  const edited = sessions.filter((s) => s.unsaved.length > 0)
  return edited.flatMap((s) =>
    s.unsaved.map((p) => (edited.length > 1 ? `${fileName(p)} (${s.title})` : fileName(p))),
  )
}

function confirmLabel(action: Action, sessions: ReadonlyArray<Fake>) {
  const edits = sessions.some((s) => s.unsaved.length > 0)
  if (action === "delete") return edits ? "Delete all and lose edits" : "Delete all"
  if (edits) return "Archive all and lose edits"
  return sessions.some(isRunning) ? "Stop and archive all" : "Archive all"
}

function failureOf(action: Action) {
  return action === "archive"
    ? "The session could not be archived. Try again."
    : "The session could not be deleted. Try again."
}

function Mark({ session }: { session: Fake }) {
  return (
    <SessionMark
      status={session.status}
      harness="claude"
      waitingFor={null}
      tasks={session.tasks ?? []}
    />
  )
}

function useInactive() {
  const [sessions, setSessions] = useState(INACTIVE)
  const [failures, setFailures] = useState<Record<string, string>>({})
  const apply = (action: Action, targets: ReadonlyArray<Fake>) => {
    const failed = targets.filter((s) => s.fails)
    const done = new Set(targets.filter((s) => !s.fails).map((s) => s.id))
    setSessions((all) => all.filter((s) => !done.has(s.id)))
    setFailures(Object.fromEntries(failed.map((s) => [s.id, failureOf(action)])))
  }
  return { sessions, failures, apply }
}

function SectionHead({
  count,
  open,
  onToggle,
  onPick,
}: {
  count: number
  open: boolean
  onToggle: () => void
  onPick: (action: Action) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="proto-section-head" data-menu-open={menuOpen || undefined}>
      <button
        type="button"
        className="proto-section-summary"
        aria-expanded={open}
        onClick={onToggle}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span>
          Inactive sessions · <span>{count}</span>
        </span>
        <span className="proto-section-chevron" data-open={open || undefined}>
          <Icon name="chevron-right" size={12} />
        </span>
      </button>
      <span className="proto-section-menu">
        <Menu
          align="end"
          onOpenChange={setMenuOpen}
          trigger={<IconButton icon="ellipsis" label="Actions for the inactive sessions" size="sm" />}
          items={[
            { label: "Archive all", icon: "archive", onSelect: () => onPick("archive") },
            "separator",
            { label: "Delete all…", icon: "trash", danger: true, onSelect: () => onPick("delete") },
          ]}
        />
      </span>
    </div>
  )
}

function InactiveRow({ session, failure, below }: { session: Fake; failure?: string; below?: ReactNode }) {
  const extra = failure ? <ErrorMessage message={failure} /> : below
  return (
    <ListRow
      leading={<Mark session={session} />}
      title={session.title}
      meta={session.ago}
      actions={
        <Menu
          align="end"
          trigger={<IconButton icon="ellipsis" label={`Actions for ${session.title}`} size="sm" />}
          items={[
            { label: "Archive", icon: "archive", onSelect: () => {} },
            "separator",
            { label: "Delete…", icon: "trash", danger: true, onSelect: () => {} },
          ]}
        />
      }
      {...(extra !== undefined && { below: extra })}
    />
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="proto-app">
      <aside className="proto-card">
        <div className="proto-card-top">
          <span className="proto-lights">
            <i />
            <i />
            <i />
          </span>
          <IconButton icon="panel-left" label="Hide sidebar" size="sm" />
          <span className="proto-grow" />
          <IconButton icon="gear" label="Settings" size="sm" />
        </div>
        <div className="proto-card-body">
          <div className="proto-rail">
            <span className="proto-creature" data-selected />
            <span className="proto-creature" style={{ background: "var(--iv-hue-3, #7aa8d8)" }} />
          </div>
          <div className="proto-column">
            <div className="proto-list-head">
              <span className="proto-creature proto-creature--sm" />
              <strong>ivin</strong>
              <span className="proto-grow" />
              <IconButton icon="new-session" label="New session" size="sm" />
              <IconButton icon="ellipsis" label="Project actions" size="sm" />
            </div>
            <div className="proto-tabs">
              <span data-selected>Sessions</span>
              <span>Files</span>
              <span>Changes</span>
            </div>
            <div className="proto-panel">
              <ListSection label="Sessions" count={OPEN.length}>
                {OPEN.map((s, i) => (
                  <li key={s.id}>
                    <ListRow
                      leading={<Mark session={s} />}
                      title={s.title}
                      meta={s.ago}
                      selected={i === 0}
                    />
                  </li>
                ))}
              </ListSection>
              {children}
            </div>
          </div>
        </div>
      </aside>
      <main className="proto-main">
        <div className="proto-tabbar">
          <span className="proto-tab" data-selected>
            Group the tabs into named groups
          </span>
          <span className="proto-tab">Show the release notes in the update card</span>
        </div>
        <div className="proto-transcript">
          <div className="proto-bubble">
            Let a project's tabs go into named groups that fold, in the tab bar and in the sidebar.
          </div>
          <p>
            I'll start with the tab bar: a group is a labelled run of tabs, and folding it keeps
            only its label. Then the sidebar lists the same groups under the Sessions tab.
          </p>
        </div>
      </main>
    </div>
  )
}

function DialogActions({ onCancel, onConfirm, label }: { onCancel: () => void; onConfirm: () => void; label: string }) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="danger" onClick={onConfirm}>
        {label}
      </Button>
    </>
  )
}

function FileList({ files }: { files: ReadonlyArray<string> }) {
  if (files.length === 0) return null
  return (
    <ul className="iv-session-action-dialog__files">
      {files.map((name) => (
        <li key={name} className="iv-session-action-dialog__file">
          {name}
        </li>
      ))}
    </ul>
  )
}

function useModalFlow() {
  const state = useInactive()
  const [open, setOpen] = useState(true)
  const [pending, setPending] = useState<{ action: Action; sessions: ReadonlyArray<Fake> } | null>(null)
  const [shown, setShown] = useState(pending)
  useEffect(() => {
    if (pending) setShown(pending)
  }, [pending])
  const confirm = () => {
    if (pending) state.apply(pending.action, pending.sessions)
    setPending(null)
  }
  return { ...state, open, setOpen, pending, setPending, shown, confirm }
}

function ModalVariant({ body }: { body: (action: Action, sessions: ReadonlyArray<Fake>) => { description: string; content: ReactNode } }) {
  const flow = useModalFlow()
  if (flow.sessions.length === 0) return <Frame>{null}</Frame>
  const shown = flow.shown
  const text = shown ? body(shown.action, shown.sessions) : { description: "", content: null }
  return (
    <Frame>
      <section className="proto-section">
        <SectionHead
          count={flow.sessions.length}
          open={flow.open}
          onToggle={() => flow.setOpen(!flow.open)}
          onPick={(action) => flow.setPending({ action, sessions: flow.sessions })}
        />
        {flow.open && (
          <ul className="proto-rows">
            {flow.sessions.map((s) => (
              <li key={s.id}>
                <InactiveRow session={s} failure={flow.failures[s.id]} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog
        open={flow.pending !== null}
        onOpenChange={(o) => {
          if (!o) flow.setPending(null)
        }}
        title={
          shown
            ? `${shown.action === "archive" ? "Archive" : "Delete"} ${plural(shown.sessions.length, "inactive session")}?`
            : ""
        }
        description={text.description}
        actions={
          shown && (
            <DialogActions
              onCancel={() => flow.setPending(null)}
              onConfirm={flow.confirm}
              label={confirmLabel(shown.action, shown.sessions)}
            />
          )
        }
      >
        {text.content}
      </Dialog>
    </Frame>
  )
}

function Summary_({ action, sessions }: { action: Action; sessions: ReadonlyArray<Fake> }) {
  const running = sessions.filter(isRunning).length
  const files = editedFiles(sessions)
  return (
    <div className="proto-summary">
      {action === "delete" && (
        <ul className="proto-titles">
          {sessions.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ul>
      )}
      {running > 0 && (
        <p className="proto-effect">
          {plural(running, "agent")} still running {running === 1 ? "stops" : "stop"}.
        </p>
      )}
      {files.length > 0 && (
        <>
          <p className="proto-effect">The unsaved edits to these files are lost:</p>
          <FileList files={files} />
        </>
      )}
    </div>
  )
}

export function Summary() {
  return (
    <ModalVariant
      body={(action, sessions) => ({
        description:
          action === "archive"
            ? "You can restore them from Archived sessions."
            : "The sessions and their transcripts are erased. This cannot be undone.",
        content: <Summary_ action={action} sessions={sessions} />,
      })}
    />
  )
}

export function Itemized() {
  return (
    <ModalVariant
      body={(action, sessions) => ({
        description:
          action === "archive"
            ? "You can restore them from Archived sessions."
            : "The sessions and their transcripts are erased. This cannot be undone.",
        content: (
          <ul className="proto-manifest">
            {sessions.map((s) => (
              <li key={s.id} className="proto-manifest-row">
                <div className="proto-manifest-line">
                  <Mark session={s} />
                  <span className="proto-manifest-title">{s.title}</span>
                  {isRunning(s) && <span className="proto-tag proto-tag--attention">Agent stops</span>}
                  {s.unsaved.length > 0 && (
                    <span className="proto-tag proto-tag--danger">
                      {plural(s.unsaved.length, "unsaved file")}
                    </span>
                  )}
                </div>
                {s.unsaved.length > 0 && (
                  <div className="proto-manifest-files">
                    <FileList files={s.unsaved.map(fileName)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ),
      })}
    />
  )
}

function loss(s: Fake): string | null {
  const parts = [
    ...(isRunning(s) ? ["Agent stops"] : []),
    ...(s.unsaved.length > 0 ? [`Unsaved edits to ${s.unsaved.map(fileName).join(", ")} are lost`] : []),
  ]
  return parts.length === 0 ? null : parts.join(" · ")
}

export function InPlace() {
  const state = useInactive()
  const [open, setOpen] = useState(true)
  const [pending, setPending] = useState<Action | null>(null)
  useEffect(() => {
    if (pending === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [pending])
  if (state.sessions.length === 0) return <Frame>{null}</Frame>
  const confirm = () => {
    if (pending) state.apply(pending, state.sessions)
    setPending(null)
  }
  return (
    <Frame>
      <section className="proto-section" data-pending={pending ?? undefined}>
        {pending === null ? (
          <SectionHead
            count={state.sessions.length}
            open={open}
            onToggle={() => setOpen(!open)}
            onPick={(action) => {
              setOpen(true)
              setPending(action)
            }}
          />
        ) : (
          <div className="proto-confirm" role="group" aria-label="Confirm">
            <span className="proto-confirm-text">
              {pending === "archive" ? "Archive" : "Delete"} {plural(state.sessions.length, "session")}?
              {pending === "delete" && <span className="proto-confirm-sub">This cannot be undone.</span>}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={confirm}>
              {confirmLabel(pending, state.sessions).replace(" and lose edits", "")}
            </Button>
          </div>
        )}
        {open && (
          <ul className="proto-rows">
            {state.sessions.map((s) => {
              const lost = pending ? loss(s) : null
              return (
                <li key={s.id}>
                  <InactiveRow
                    session={s}
                    failure={state.failures[s.id]}
                    {...(lost !== null && {
                      below: (
                        <span className="proto-loss">
                          <span className="proto-loss-dot" />
                          {lost}
                        </span>
                      ),
                    })}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Frame>
  )
}
