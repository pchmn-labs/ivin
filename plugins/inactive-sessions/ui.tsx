import {
  Disclosure,
  ListRow,
  RelativeTime,
  SessionMark,
  Stack,
  defineUi,
  useOpenTab,
  useProjects,
  useSessions,
  useTabs,
} from "@ivin/plugin-api/ui"
import { inactiveSessions } from "./rules/inactive-sessions.ts"

function InactiveSessions() {
  const sessions = inactiveSessions(useSessions(), useTabs(), useProjects().selectedPath)
  const openTab = useOpenTab()
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
            <ListRow
              data-testid="inactive-session"
              attention={session.status === "waiting"}
              onSelect={() => openTab(session.id)}
              leading={<SessionMark status={session.status} />}
              title={session.title}
              meta={<RelativeTime at={session.lastActivityAt} />}
            />
          </Stack>
        ))}
      </Stack>
    </Disclosure>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.section", InactiveSessions, { name: "section" })
})
