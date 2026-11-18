import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { isRunning } from "../rules/is-running.ts"
import { Composer } from "./composer.tsx"
import "./session-view.css"

function OpenSession({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const status = useAtomValue(sessionsOf(projectPath).item(sessionId))?.status
  const interrupt = useAtomSet(interruptSessionAtom)
  useCommandHandler(
    "session.interrupt",
    () => interrupt({ projectPath, sessionId }),
    isRunning(status),
  )

  return (
    <div className="iv-session-view">
      <div className="iv-session-view__transcript">
        <TranscriptView key={sessionId} sessionId={sessionId} />
      </div>
      <Composer key={sessionId} projectPath={projectPath} sessionId={sessionId} />
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
