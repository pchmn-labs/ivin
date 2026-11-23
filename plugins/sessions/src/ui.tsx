import { useState } from "react"
import {
  ErrorMessage,
  IconButton,
  ListRow,
  ListSection,
  Menu,
  RelativeTime,
  SessionLocation,
  SessionMark,
  Slot,
  Stack,
  Text,
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
  useTabsLoaded,
  type Session,
} from "@ivin/plugin-api/ui"
import { openSessions } from "./rules/open-sessions.ts"

function SessionRow({ session, selected }: { session: Session; selected: boolean }) {
  const openTab = useOpenTab()
  const rename = useRenameSession()
  const [draft, setDraft] = useState<string | null>(null)
  const location = useSessionLocation(session)
  const actions = useSessionActions(session)

  const commit = () => {
    const title = draft?.trim()
    if (title && title !== session.title) rename(session, title)
    setDraft(null)
  }

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
            />
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
            items={[
              { label: "Rename", icon: "pencil", onSelect: () => setDraft(session.title) },
              "separator",
              ...actions.items,
            ]}
          />
        }
        {...(actions.failure !== null && { below: <ErrorMessage message={actions.failure} /> })}
      />
    </Stack>
  )
}

function SessionsPanel() {
  const { projects, selectedPath } = useProjects()
  const sessions = useSessions()
  const tabs = useTabs()
  const tabsLoaded = useTabsLoaded()
  const selectedSessionId = useSelectedSessionId()
  const projectName = projects.find((project) => project.path === selectedPath)?.name ?? ""
  const inProject = sessions.filter((session) => session.projectPath === selectedPath)
  const open = openSessions(inProject, tabs)

  return (
    <Stack as="nav" aria-label="Sessions" direction="column" gap={2}>
      {tabsLoaded && tabs.length === 0 && (
        <Text as="p" size="sm" tone="faint">
          {inProject.length === 0
            ? `No sessions in ${projectName} yet. Start one with New session.`
            : "No session open. Start one with New session."}
        </Text>
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
