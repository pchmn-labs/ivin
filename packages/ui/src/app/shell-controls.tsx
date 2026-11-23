import type { ReactNode } from "react"
import { IconButton } from "../core/components/button/button.tsx"
import { useKeyHint } from "../modules/keybinding/hooks/use-key-hint.ts"
import { useSessionHistory } from "../modules/session/hooks/use-session-history.ts"
import "./shell-controls.css"

export interface ShellControlsProps {
  readonly projectPath: string
  readonly sidebarOpen: boolean
  readonly onToggleSidebar: () => void
  readonly extra?: ReactNode
}

export function ShellControls({
  projectPath,
  sidebarOpen,
  onToggleSidebar,
  extra,
}: ShellControlsProps) {
  const history = useSessionHistory(projectPath)
  const toggleHint = useKeyHint("Toggle sidebar", "sidebar.toggle")
  return (
    <div className="iv-shell-controls" data-sidebar={sidebarOpen ? "open" : "closed"}>
      <span className="iv-shell-controls__lights" aria-hidden="true" />
      <IconButton
        icon="panel-left"
        label="Toggle sidebar"
        tooltip={toggleHint}
        size="sm"
        aria-expanded={sidebarOpen}
        onClick={onToggleSidebar}
      />
      {extra}
      <IconButton
        icon="arrow-left"
        label="Back"
        size="sm"
        disabled={!history.canGoBack}
        onClick={history.goBack}
      />
      <IconButton
        icon="arrow-right"
        label="Forward"
        size="sm"
        disabled={!history.canGoForward}
        onClick={history.goForward}
      />
    </div>
  )
}
