import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { NotificationViewport } from "../../../core/components/notification/notification.tsx"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { useArchiveFromKey } from "../hooks/use-session-actions.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { isAgentBusy, isRunning } from "../rules/is-running.ts"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { statusLabel } from "@ivin/plugin-api/ui"
import { ImageViewer } from "../../transcript/ui/image-viewer.tsx"
import { useCloseViewsOnMove } from "../../view/hooks/use-close-views-on-move.ts"
import { ViewDialog } from "../../view/ui/view-dialog.tsx"
import { ViewSheet } from "../../view/ui/view-sheet.tsx"
import { sheetViewsOf } from "../../view/atoms/overlay-views.ts"
import { Slot } from "../../../app/slot-renderer.tsx"
import "./session-view.css"

function OpenSession({
  projectPath,
  sessionId,
  notifications,
}: {
  projectPath: string
  sessionId: string
  notifications: boolean
}) {
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
  const workingFolder = session?.workingFolder
  useCloseViewsOnMove(sessionId, workingFolder)
  const sheetViews = useAtomValue(sheetViewsOf(sessionId, workingFolder ?? ""))
  const sheetOpen = sheetViews.selected !== null
  const interrupt = useAtomSet(interruptSessionAtom)
  const archiveFromKey = useArchiveFromKey(session)
  useCommandHandler("session.archive", archiveFromKey, session !== undefined)
  useCommandHandler(
    "session.interrupt",
    () => interrupt({ projectPath, sessionId }),
    isAgentBusy(status),
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
            background={session?.backgroundTasks ?? []}
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
      {notifications && (
        <div className="iv-session-view__notifications">
          <NotificationViewport />
        </div>
      )}
      <div className="iv-session-view__dock" data-sheet-open={sheetOpen ? "" : undefined}>
        {workingFolder !== undefined && (
          <ViewSheet sessionId={sessionId} workingFolder={workingFolder} />
        )}
        <Slot key={sessionId} slot="session.composer" props={{ sessionId }} />
      </div>
      <ImageViewer sessionId={sessionId} />
      {workingFolder !== undefined && (
        <ViewDialog sessionId={sessionId} workingFolder={workingFolder} />
      )}
    </div>
  )
}

export function SessionView({
  projectPath,
  sessionId,
  notifications = true,
}: {
  projectPath: string
  sessionId: string
  // False while the chat is hidden under a full-width file, which draws the notifications itself.
  notifications?: boolean
}) {
  useAtomMount(sessionsOf(projectPath).ids)
  return (
    <OpenSession projectPath={projectPath} sessionId={sessionId} notifications={notifications} />
  )
}
