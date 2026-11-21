import { useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { SessionView } from "../../session/ui/session-view.tsx"
import { tabsOf } from "../atoms/list-tabs.ts"
import { SubViewCard } from "./sub-view-card.tsx"
import "./tab-view.css"

function SessionTab({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const workingFolder = useAtomValue(sessionsOf(projectPath).item(sessionId))?.workingFolder
  return (
    <div className="iv-tab-view__split">
      <div className="iv-tab-view__session">
        <SessionView projectPath={projectPath} sessionId={sessionId} />
      </div>
      {workingFolder !== undefined && (
        <SubViewCard sessionId={sessionId} workingFolder={workingFolder} />
      )}
    </div>
  )
}

export function TabView({ projectPath }: { projectPath: string }) {
  const tabs = tabsOf(projectPath)
  const { selectedSessionId } = useAtomValue(tabs.value)
  const loaded = useAtomValue(tabs.loaded)

  if (!loaded) return <div className="iv-tab-view" />

  if (selectedSessionId === null) {
    return (
      <div className="iv-tab-view iv-tab-view--empty">
        <Text tone="muted">No session open. Create one from the sidebar.</Text>
      </div>
    )
  }

  return (
    <div className="iv-tab-view" role="tabpanel">
      <SessionTab key={selectedSessionId} projectPath={projectPath} sessionId={selectedSessionId} />
    </div>
  )
}
