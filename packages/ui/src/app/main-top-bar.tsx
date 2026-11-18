import { TabBar } from "../modules/tab/ui/tab-bar.tsx"
import { ShellControls, type ShellControlsProps } from "./shell-controls.tsx"
import "./main-top-bar.css"

export function MainTopBar({
  projectPath,
  controls,
}: {
  projectPath: string | null
  controls: ShellControlsProps | null
}) {
  return (
    <header className="iv-main-top-bar">
      {controls && <ShellControls {...controls} />}
      {projectPath !== null && <TabBar projectPath={projectPath} />}
    </header>
  )
}
