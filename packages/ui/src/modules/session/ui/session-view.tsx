import { useAtomMount, useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { useInterruptOnEscape } from "../hooks/use-interrupt-on-escape.ts"
import { isRunning } from "../rules/is-running.ts"
import { Composer } from "./composer.tsx"
import "./session-view.css"

export function SessionView({ projectPath }: { projectPath: string }) {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  const sessions = sessionsOf(projectPath)
  useAtomMount(sessions.ids)
  const status = useAtomValue(sessions.item(sessionId ?? ""))?.status
  useInterruptOnEscape({ projectPath, sessionId: sessionId ?? "", running: isRunning(status) })

  if (sessionId === null) {
    return (
      <div className="iv-session-view__empty">
        <Text tone="muted">Select or create a session</Text>
      </div>
    )
  }

  return (
    <div className="iv-session-view">
      <div className="iv-session-view__transcript">
        <TranscriptView key={sessionId} sessionId={sessionId} />
      </div>
      <Composer key={sessionId} projectPath={projectPath} sessionId={sessionId} />
    </div>
  )
}
