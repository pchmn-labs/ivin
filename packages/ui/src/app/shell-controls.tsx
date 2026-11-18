import { IconButton } from "../core/components/button/button.tsx"
import { useSessionHistory } from "../modules/session/hooks/use-session-history.ts"
import "./shell-controls.css"

export interface ShellControlsProps {
  readonly sidebarOpen: boolean
  readonly onToggleSidebar: () => void
}

export function ShellControls({ sidebarOpen, onToggleSidebar }: ShellControlsProps) {
  const history = useSessionHistory()
  return (
    <div className="iv-shell-controls" data-sidebar={sidebarOpen ? "open" : "closed"}>
      <IconButton
        icon="panel-left"
        label="Toggle sidebar"
        size="sm"
        aria-expanded={sidebarOpen}
        onClick={onToggleSidebar}
      />
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
