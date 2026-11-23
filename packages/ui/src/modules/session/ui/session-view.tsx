import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { NotificationViewport } from "../../../core/components/notification/notification.tsx"
import { CommandFailure } from "../../command/rules/command-failure.ts"
import { sessionActionFailureOf } from "../atoms/session-action-failure.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { useRequestSessionAction } from "../hooks/use-session-actions.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { isRunning } from "../rules/is-running.ts"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { statusLabel } from "@ivin/plugin-api/ui"
import { ImageViewer } from "../../transcript/ui/image-viewer.tsx"
import { Slot } from "../../../app/slot-renderer.tsx"
import "./session-view.css"

function OpenSession({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const sessions = sessionsOf(projectPath)
  const session = useAtomValue(sessions.item(sessionId))
  const sessionsLoaded = AsyncResult.isSuccess(
    useAtomValue(sessions.status) ?? AsyncResult.initial(),
  )
  const status = session?.status
  const transcript = useAtomValue(transcriptOf(sessionId).view)
  const projectName = useAtomValue(projectsAtom.value).projects.find(
    (project) => project.path === projectPath,
  )?.name
  const interrupt = useAtomSet(interruptSessionAtom)
  const requestAction = useRequestSessionAction()
  const registry = useContext(RegistryContext)
  useCommandHandler(
    "session.archive",
    async () => {
      if (session === undefined) return
      await requestAction("archive", session)
      // The failure otherwise shows in a menu that is closed when the key is pressed.
      const failure = registry.get(sessionActionFailureOf(session.id))
      if (failure !== null) {
        throw new CommandFailure(failure, () => void requestAction("archive", session))
      }
    },
    session !== undefined,
  )
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
    (!transcript.loaded || transcript.rows.length === 0)

  // The title keeps its place among the children, so the composer survives the switch.
  return (
    <div className={blank ? "iv-session-view iv-session-view--blank" : "iv-session-view"}>
      {blank && (
        <h1 className="iv-session-view__title">What should we work on in {projectName}?</h1>
      )}
      {!blank && (
        <div className="iv-session-view__transcript">
          <TranscriptView
            key={sessionId}
            sessionId={sessionId}
            live={isRunning(status)}
            sessionGone={session === undefined && sessionsLoaded}
          />
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
      <div className="iv-session-view__notifications">
        <NotificationViewport />
      </div>
      <Slot key={sessionId} slot="session.composer" props={{ sessionId }} />
      <ImageViewer sessionId={sessionId} />
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
