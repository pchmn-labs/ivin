import { useAtomValue } from "@effect/atom-react"
import { Atom } from "effect/reactivity"
import { Text } from "../../../core/components/text/text.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { HARNESSES } from "../../session/rules/harnesses.ts"
import { SessionView } from "../../session/ui/session-view.tsx"
import { subViewsOf } from "../atoms/list-sub-views.ts"
import { tabsOf } from "../atoms/list-tabs.ts"
import { SubViewCard } from "./sub-view-card.tsx"
import "./tab-view.css"

const noSubViews = Atom.make(null)

function SessionTab({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const workingFolder = session?.workingFolder
  const subViews = useAtomValue(
    workingFolder === undefined ? noSubViews : subViewsOf(sessionId, workingFolder).value,
  )
  const fullWidth = subViews !== null && subViews.selected !== null && subViews.fullWidth
  const onSession = fullWidth && subViews.sessionTabSelected
  return (
    <div
      className="iv-tab-view__split"
      data-full-width={fullWidth || undefined}
      data-on-session={onSession || undefined}
    >
      <div
        className="iv-tab-view__session"
        role={fullWidth ? "tabpanel" : undefined}
        aria-label={fullWidth ? "Session" : undefined}
        // Kept mounted under a file, so the chat keeps its scroll and its draft.
        inert={(fullWidth && !onSession) || undefined}
      >
        <SessionView projectPath={projectPath} sessionId={sessionId} />
      </div>
      {session !== undefined && (
        <SubViewCard
          sessionId={sessionId}
          workingFolder={session.workingFolder}
          harnessMark={HARNESSES[session.harness].mark}
        />
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
