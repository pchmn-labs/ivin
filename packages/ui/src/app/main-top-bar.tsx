import { useAtomValue } from "@effect/atom-react"
import { Text } from "../core/components/text/text.tsx"
import { sessionsOf } from "../modules/session/atoms/list-sessions.ts"
import { selectedSessionIdAtom } from "../modules/session/atoms/selected-session.ts"
import { ShellControls, type ShellControlsProps } from "./shell-controls.tsx"
import "./main-top-bar.css"

function SessionTitle({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  if (!session) return null
  return (
    <Text weight="medium" size="sm" truncate data-testid="session-header-title">
      {session.title}
    </Text>
  )
}

export function MainTopBar({
  projectPath,
  controls,
}: {
  projectPath: string | null
  controls: ShellControlsProps | null
}) {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  return (
    <header className="iv-main-top-bar">
      {controls && <ShellControls {...controls} />}
      {projectPath !== null && sessionId !== null && (
        <SessionTitle projectPath={projectPath} sessionId={sessionId} />
      )}
    </header>
  )
}
