import { useAtomValue } from "@effect/atom-react"
import { TranscriptView } from "../../transcript/ui/transcript-view.tsx"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { Composer } from "./composer.tsx"

export function SessionView({ projectPath }: { projectPath: string }) {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  if (sessionId === null) return <p>Select or create a session</p>

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TranscriptView key={sessionId} sessionId={sessionId} />
      </div>
      <Composer key={sessionId} projectPath={projectPath} sessionId={sessionId} />
    </div>
  )
}
