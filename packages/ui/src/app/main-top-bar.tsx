import { useAtomValue } from "@effect/atom-react"
import { Text } from "../core/components/text/text.tsx"
import { sessionsOf } from "../modules/session/atoms/list-sessions.ts"
import { selectedSessionIdAtom } from "../modules/session/atoms/selected-session.ts"
import { ShellControls, type ShellControlsProps } from "./shell-controls.tsx"
import "./main-top-bar.css"

export function MainTopBar({
  projectPath,
  controls,
}: {
  projectPath: string
  controls: ShellControlsProps | null
}) {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId ?? ""))
  return (
    <header className="iv-main-top-bar">
      {controls && (
        <>
          <span className="iv-main-top-bar__lights" aria-hidden="true" />
          <ShellControls {...controls} />
        </>
      )}
      {session && (
        <Text weight="medium" size="sm" truncate data-testid="session-header-title">
          {session.title}
        </Text>
      )}
    </header>
  )
}
