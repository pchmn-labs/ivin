import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { isRunning } from "../rules/is-running.ts"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { statusLabel } from "../rules/status-label.ts"
import { Composer } from "./composer.tsx"
import "./session-view.css"

function OpenSession({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const status = session?.status
  const transcript = useAtomValue(transcriptOf(sessionId).view)
  const projectName = useAtomValue(projectsAtom.value).projects.find(
    (project) => project.path === projectPath,
  )?.name
  const interrupt = useAtomSet(interruptSessionAtom)
  useCommandHandler(
    "session.interrupt",
    () => interrupt({ projectPath, sessionId }),
    isRunning(status),
  )

  // Not waiting for the transcript to load, so a new session does not open docked then jump.
  const blank =
    session !== undefined &&
    !session.started &&
    status === "idle" &&
    (!transcript.loaded || transcript.ids.length === 0)

  // The title keeps its place among the children, so the composer survives the switch.
  return (
    <div className={blank ? "iv-session-view iv-session-view--blank" : "iv-session-view"}>
      {blank && (
        <h1 className="iv-session-view__title">What should we work on in {projectName}?</h1>
      )}
      {!blank && (
        <div className="iv-session-view__transcript">
          <TranscriptView key={sessionId} sessionId={sessionId} />
        </div>
      )}
      {status === "preparing_worktree" && (
        <div className="iv-session-view__preparing" data-testid="preparing-worktree">
          <Icon name="loader" size={14} />
          <Text size="sm" tone="muted">
            {statusLabel(status)}
          </Text>
        </div>
      )}
      <Composer
        key={sessionId}
        projectPath={projectPath}
        sessionId={sessionId}
        {...(blank && { placeholder: "Describe the task" })}
      />
    </div>
  )
}

export function SessionView({
  projectPath,
  sessionId,
}: {
  projectPath: string
  sessionId: string
}) {
  useAtomMount(sessionsOf(projectPath).ids)
  return <OpenSession projectPath={projectPath} sessionId={sessionId} />
}
