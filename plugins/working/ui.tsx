import { useEffect, useState } from "react"
import {
  Disclosure,
  ListRow,
  ListSection,
  SessionMark,
  Stack,
  Text,
  defineUi,
  useOpenTab,
  useProjects,
  useSelectedSessionId,
  useSessions,
  type Project,
  type Session,
} from "@ivin/plugin-api/ui"
import { elapsed } from "./rules/elapsed.ts"
import { workingSessions } from "./rules/working-sessions.ts"

// One timer for the whole panel, so the rows tick together.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function Group({
  label,
  attention = false,
  sessions,
  projectNames,
  now,
}: {
  label: string
  attention?: boolean
  sessions: ReadonlyArray<Session>
  projectNames: ReadonlyMap<string, string>
  now: number
}) {
  const openTab = useOpenTab()
  if (sessions.length === 0) return null
  return (
    <ListSection label={label} count={sessions.length} attention={attention}>
      {sessions.map((session) => (
        <Stack as="li" key={session.id}>
          <ListRow
            data-testid="working-session"
            attention={session.status === "waiting"}
            onSelect={() => openTab(session.id)}
            leading={<SessionMark status={session.status} />}
            title={session.title}
            subtitle={projectNames.get(session.projectPath)}
            meta={elapsed(session.statusChangedAt.epochMilliseconds, now)}
          />
        </Stack>
      ))}
    </ListSection>
  )
}

function WorkingPanel() {
  const { projects } = useProjects()
  const { needsYou, running } = workingSessions(useSessions(), projects, useSelectedSessionId())
  const count = needsYou.length + running.length
  if (count === 0) return null
  return <Panel count={count} needsYou={needsYou} running={running} projects={projects} />
}

function Panel({
  count,
  needsYou,
  running,
  projects,
}: {
  count: number
  needsYou: ReadonlyArray<Session>
  running: ReadonlyArray<Session>
  projects: ReadonlyArray<Project>
}) {
  const now = useNow()
  const projectNames = new Map(projects.map((project) => [project.path, project.name]))
  return (
    <Disclosure
      data-testid="working-panel"
      variant="section"
      defaultOpen
      summary={
        <span>
          Working · <span>{count}</span>
          {needsYou.length > 0 && (
            <Text size="xs" tone="danger">
              {" "}
              · {needsYou.length} need{needsYou.length === 1 ? "s" : ""} you
            </Text>
          )}
        </span>
      }
    >
      <Group
        label="Needs you"
        attention
        sessions={needsYou}
        projectNames={projectNames}
        now={now}
      />
      <Group label="Running" sessions={running} projectNames={projectNames} now={now} />
    </Disclosure>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.section", WorkingPanel, { name: "panel", order: -1 })
})
