import { useState } from "react"
import {
  ErrorMessage,
  IconButton,
  ListRow,
  ListSection,
  Menu,
  RelativeTime,
  SessionLocation,
  SessionCardTrigger,
  SessionMark,
  Slot,
  Stack,
  TextField,
  defineUi,
  useOpenTab,
  useProjects,
  useRenameSession,
  useSelectedSessionId,
  useSessionActions,
  useSessionLocation,
  useSessions,
  useTabs,
  useSessionListStatus,
  type Session,
} from "@ivin/plugin-api/ui"
import { openSessions } from "./rules/open-sessions.ts"

function SessionRow({ session, selected }: { session: Session; selected: boolean }) {
  const openTab = useOpenTab()
  const { rename, failure: renameFailure } = useRenameSession(session)
  const [draft, setDraft] = useState<string | null>(null)
  const location = useSessionLocation(session)
  const actions = useSessionActions(session)

  const commit = () => {
    const title = draft?.trim()
    if (title && title !== session.title) rename(title)
    setDraft(null)
  }

  const below =
    actions.failure !== null ? (
      <ErrorMessage message={actions.failure} />
    ) : renameFailure ? (
      <ErrorMessage {...renameFailure} />
    ) : null

  if (draft !== null) {
    return (
      <Stack as="li" data-testid="session-item">
        <TextField
          label="Session title"
          autoFocus
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          onSubmit={commit}
          onEscape={() => setDraft(null)}
        />
      </Stack>
    )
  }

  return (
    <Stack as="li">
      <SessionCardTrigger session={session} place="row">
        <ListRow
          data-testid="session-item"
          selected={selected}
          attention={session.status === "waiting"}
          aria-current={selected}
          onSelect={() => openTab(session.id)}
          leading={
            <span data-testid="session-status">
              <SessionMark
                status={session.status}
                waitingFor={session.waitingFor}
                harness={session.harness}
                tasks={session.backgroundTasks}
              />
            </span>
          }
          title={<span data-testid="session-title">{session.title}</span>}
          {...(location.kind !== "folder" && {
            subtitle: <SessionLocation location={location} compact />,
          })}
          meta={
            <Stack direction="row" gap={2} align="center">
              <Slot slot="session.badge" props={{ session }} />
              <RelativeTime at={session.lastActivityAt} />
            </Stack>
          }
          actions={
            <Menu
              align="end"
              trigger={<IconButton icon="ellipsis" label="Session actions" size="sm" />}
              items={[
                { label: "Rename", icon: "pencil", onSelect: () => setDraft(session.title) },
                "separator",
                ...actions.items,
              ]}
            />
          }
          {...(below && { below })}
        />
      </SessionCardTrigger>
    </Stack>
  )
}

function SessionsPanel() {
  const { selectedPath } = useProjects()
  const sessions = useSessions()
  const tabs = useTabs()
  const { loaded: tabsLoaded, failed, retry } = useSessionListStatus()
  const selectedSessionId = useSelectedSessionId()
  const inProject = sessions.filter((session) => session.projectPath === selectedPath)
  const open = openSessions(inProject, tabs)

  return (
    <Stack as="nav" aria-label="Sessions" direction="column">
      {failed && (
        <ErrorMessage
          message={
            open.length === 0 ? "The sessions could not be loaded." : "Sessions may be out of date."
          }
          onRetry={retry}
        />
      )}
      {!failed && (!tabsLoaded || (tabs.length > 0 && open.length === 0)) && (
        <ListSection label="Sessions" loading />
      )}
      {open.length > 0 && (
        <ListSection label="Sessions" count={open.length}>
          {open.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              selected={session.id === selectedSessionId}
            />
          ))}
        </ListSection>
      )}
      <Slot slot="sidebar.section" props={{}} />
    </Stack>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.panel", SessionsPanel, { name: "panel", title: "Sessions", order: -1 })
})
