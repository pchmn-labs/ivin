import {
  Disclosure,
  ErrorMessage,
  IconButton,
  ListRow,
  Menu,
  RelativeTime,
  SessionMark,
  Stack,
  defineUi,
  useOpenTab,
  useProjects,
  useSessionActions,
  useSessions,
  useTabs,
} from "@ivin/plugin-api/ui"
import type { Session } from "@ivin/plugin-api/ui"
import { inactiveSessions } from "./rules/inactive-sessions.ts"

function InactiveSession({ session }: { session: Session }) {
  const openTab = useOpenTab()
  const actions = useSessionActions(session)
  return (
    <ListRow
      data-testid="inactive-session"
      attention={session.status === "waiting"}
      onSelect={() => openTab(session.id)}
      leading={
        <SessionMark
          status={session.status}
          waitingFor={session.waitingFor}
          harness={session.harness}
          tasks={session.backgroundTasks}
        />
      }
      title={session.title}
      meta={<RelativeTime at={session.lastActivityAt} />}
      actions={
        <Menu
          align="end"
          trigger={<IconButton icon="ellipsis" label={`Actions for ${session.title}`} size="sm" />}
          items={actions.items}
        />
      }
      {...(actions.failure !== null && { below: <ErrorMessage message={actions.failure} /> })}
    />
  )
}

function InactiveSessions() {
  const sessions = inactiveSessions(useSessions(), useTabs(), useProjects().selectedPath)
  if (sessions.length === 0) return null
  return (
    <Disclosure
      data-testid="inactive-sessions"
      variant="section"
      summary={
        <span>
          Inactive sessions · <span>{sessions.length}</span>
        </span>
      }
    >
      <Stack as="ul" gap={0}>
        {sessions.map((session) => (
          <Stack as="li" key={session.id}>
            <InactiveSession session={session} />
          </Stack>
        ))}
      </Stack>
    </Disclosure>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.section", InactiveSessions, { name: "section" })
})
