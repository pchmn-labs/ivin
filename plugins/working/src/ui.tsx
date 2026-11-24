import { useEffect, useState } from "react"
import {
  Button,
  Disclosure,
  ErrorMessage,
  ListRow,
  ListSection,
  ProjectMark,
  SessionMark,
  Stack,
  Text,
  defineUi,
  formatToolInput,
  useAnswerApproval,
  useOpenTab,
  usePendingApproval,
  usePendingQuestion,
  useProjects,
  useSelectedSessionId,
  useSessions,
  type ActionFailure,
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

// Lines continued with a backslash are one shell line; past that, only the first line shows.
const commandLine = (command: string) => command.replace(/\s*\\\n\s*/g, " ").split("\n", 1)[0] ?? ""

// "[bg] Review the diff +2": the first task, and how many others run.
const backgroundLine = (tasks: Session["backgroundTasks"]) =>
  tasks.length === 0
    ? undefined
    : `[bg] ${tasks[0]!.description}${tasks.length > 1 ? ` +${tasks.length - 1}` : ""}`

function Detail({
  project,
  question,
  background,
}: {
  project: string
  question?: string
  background?: string
}) {
  return (
    <Stack as="span" direction="row" gap={1} align="center">
      <ProjectMark name={project} size={12} />
      <Text size="xs" tone="faint" truncate>
        {project}
      </Text>
      {question === undefined ? null : (
        <>
          <Text size="xs" tone="faint">
            ·
          </Text>
          <Text size="xs" tone="muted" truncate data-testid="working-question">
            {question}
          </Text>
        </>
      )}
      {background === undefined ? null : (
        <>
          <Text size="xs" tone="faint">
            ·
          </Text>
          <Text size="xs" tone="muted" truncate data-testid="working-background">
            {background}
          </Text>
        </>
      )}
    </Stack>
  )
}

function WaitingRow({ session, project }: { session: Session; project: string }) {
  const openTab = useOpenTab()
  const answer = useAnswerApproval(session.id)
  const pending = usePendingApproval(session.id)
  const question = usePendingQuestion(session.id)?.questions[0]?.question
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<(ActionFailure & { allow: boolean }) | null>(null)
  const command = pending === undefined ? undefined : formatToolInput(pending.name, pending.input)

  const respond = (allow: boolean) => {
    if (pending === undefined || sending) return
    setSending(true)
    setFailure(null)
    void answer({ requestId: pending.requestId, allow }).then((failed) => {
      setSending(false)
      if (failed !== undefined) setFailure({ allow, ...failed })
    })
  }

  return (
    <Stack as="li">
      <ListRow
        data-testid="working-session"
        attention
        onSelect={() => openTab(session.id)}
        leading={
          <SessionMark
            status={session.status}
            waitingFor={session.waitingFor}
            harness={session.harness}
          />
        }
        title={session.title}
        {...(command === undefined
          ? { subtitle: <Detail project={project} {...(question !== undefined && { question })} /> }
          : { tooltip: { text: command, label: "Approval needed", mono: true } })}
        {...(command !== undefined && {
          below: (
            <Stack direction="column" gap={2} grow>
              <Text size="xs" code truncate data-testid="working-command">
                {commandLine(command)}
              </Text>
              <Stack direction="row" gap={1} align="center">
                <Stack as="span" grow>
                  <Detail project={project} />
                </Stack>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={sending}
                  aria-label={`Allow: ${session.title}`}
                  onClick={() => respond(true)}
                >
                  Allow
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sending}
                  aria-label={`Deny: ${session.title}`}
                  onClick={() => respond(false)}
                >
                  Deny
                </Button>
              </Stack>
              {failure && (
                <ErrorMessage
                  message={failure.text}
                  {...(failure.retryable && { onRetry: () => respond(failure.allow) })}
                />
              )}
            </Stack>
          ),
        })}
      />
    </Stack>
  )
}

function RunningRow({ session, project, now }: { session: Session; project: string; now: number }) {
  const openTab = useOpenTab()
  return (
    <Stack as="li">
      <ListRow
        data-testid="working-session"
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
        subtitle={
          <Detail
            project={project}
            {...(session.status === "in_background" && {
              background: backgroundLine(session.backgroundTasks) ?? "In background",
            })}
          />
        }
        meta={elapsed(session.statusChangedAt.epochMilliseconds, now)}
      />
    </Stack>
  )
}

function Panel({
  needsYou,
  running,
  projectNames,
}: {
  needsYou: ReadonlyArray<Session>
  running: ReadonlyArray<Session>
  projectNames: ReadonlyMap<string, string>
}) {
  const now = useNow()
  const project = (session: Session) => projectNames.get(session.projectPath) ?? ""
  return (
    <Disclosure
      data-testid="working-panel"
      variant="panel"
      defaultOpen
      summary={
        <span>
          Working · <span>{needsYou.length + running.length}</span>
          {needsYou.length > 0 && (
            <Text size="xs" tone="attention">
              {" "}
              · {needsYou.length} need{needsYou.length === 1 ? "s" : ""} you
            </Text>
          )}
        </span>
      }
    >
      {needsYou.length > 0 && (
        <ListSection label="Needs you" count={needsYou.length} attention hideLabel>
          {needsYou.map((session) => (
            <WaitingRow key={session.id} session={session} project={project(session)} />
          ))}
        </ListSection>
      )}
      {running.length > 0 && (
        <ListSection label="Running" count={running.length}>
          {running.map((session) => (
            <RunningRow key={session.id} session={session} project={project(session)} now={now} />
          ))}
        </ListSection>
      )}
    </Disclosure>
  )
}

function WorkingPanel() {
  const { projects } = useProjects()
  const { needsYou, running } = workingSessions(useSessions(), projects, useSelectedSessionId())
  if (needsYou.length + running.length === 0) return null
  const projectNames = new Map(projects.map((project) => [project.path, project.name]))
  return <Panel needsYou={needsYou} running={running} projectNames={projectNames} />
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.bottom", WorkingPanel, { name: "panel" })
})
