import { useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { SessionView } from "../../session/ui/session-view.tsx"
import { tabsOf } from "../atoms/list-tabs.ts"
import "./tab-view.css"

export function TabView({ projectPath }: { projectPath: string }) {
  const { selectedSessionId } = useAtomValue(tabsOf(projectPath).value)

  if (selectedSessionId === null) {
    return (
      <div className="iv-tab-view iv-tab-view--empty">
        <Text tone="muted">No session open. Create one from the sidebar.</Text>
      </div>
    )
  }

  return (
    <div className="iv-tab-view" role="tabpanel">
      <SessionView
        key={selectedSessionId}
        projectPath={projectPath}
        sessionId={selectedSessionId}
      />
    </div>
  )
}
