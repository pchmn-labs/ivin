import { useAtomMount, useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { useInterruptOnEscape } from "../hooks/use-interrupt-on-escape.ts"
import { isRunning } from "../rules/is-running.ts"
import { Composer } from "./composer.tsx"
import "./session-view.css"

function OpenSession({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const status = useAtomValue(sessionsOf(projectPath).item(sessionId))?.status
  useInterruptOnEscape({ projectPath, sessionId, running: isRunning(status) })

  return (
    <div className="iv-session-view">
      <div className="iv-session-view__transcript">
        <TranscriptView key={sessionId} sessionId={sessionId} />
      </div>
      <Composer key={sessionId} projectPath={projectPath} sessionId={sessionId} />
    </div>
  )
}

export function SessionView({ projectPath }: { projectPath: string }) {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  useAtomMount(sessionsOf(projectPath).ids)

  if (sessionId === null) {
    return (
      <div className="iv-session-view__empty">
        <Text tone="muted">Select or create a session</Text>
      </div>
    )
  }

  return <OpenSession projectPath={projectPath} sessionId={sessionId} />
}
