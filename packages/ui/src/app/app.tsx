import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useState } from "react"
import { Tooltip } from "../core/components/tooltip/tooltip.tsx"
import { getCurrentProjectAtom } from "../modules/project/atoms/get-current-project.ts"
import { NoProject, OpenFolderError, ProjectRail } from "../modules/project/ui/project-picker.tsx"
import { SessionList } from "../modules/session/ui/session-list.tsx"
import { SessionView } from "../modules/session/ui/session-view.tsx"
import { PluginsProvider } from "./plugin-host.tsx"
import { builtinPlugins } from "./builtin-plugins.ts"
import { MainTopBar } from "./main-top-bar.tsx"
import { ShellControls } from "./shell-controls.tsx"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"
import "./app.css"

export function App() {
  const result = useAtomValue(getVersionAtom)
  const project = useAtomValue(getCurrentProjectAtom)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const current = AsyncResult.isSuccess(project) ? project.value : null
  const projectPath = current?.path ?? null

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const connection = AsyncResult.match(result, {
    onInitial: () => ({ state: "connecting", text: "Connecting to the server…" }),
    onFailure: () => ({ state: "failed", text: "The server did not answer" }),
    onSuccess: ({ value }) => ({ state: "connected", text: `Server ${value}` }),
  })
  const version = (
    <Tooltip content={connection.text} side="right">
      <span className="iv-connection" data-state={connection.state} data-testid="server-version">
        <span className="iv-visually-hidden">{connection.text}</span>
      </span>
    </Tooltip>
  )
  const controls = { sidebarOpen, onToggleSidebar: () => setSidebarOpen((open) => !open) }

  return (
    <PluginsProvider plugins={builtinPlugins}>
      {current === null || projectPath === null ? (
        <div className="iv-app iv-app--empty">
          <main className="iv-app__main">
            <header className="iv-main-top-bar" />
            <OpenFolderError />
            <NoProject />
          </main>
          <div className="iv-app__corner">{version}</div>
        </div>
      ) : (
        <div className="iv-app" data-sidebar={sidebarOpen ? "open" : "closed"}>
          {sidebarOpen && (
            <aside className="iv-app__card" aria-label="Projects and sessions">
              <div className="iv-app__card-top">
                <span className="iv-app__lights" aria-hidden="true" />
                <ShellControls {...controls} />
              </div>
              <div className="iv-app__card-body">
                <ProjectRail footer={version} />
                <SessionList projectPath={projectPath} projectName={current.name} />
              </div>
            </aside>
          )}
          <main className="iv-app__main">
            <MainTopBar projectPath={projectPath} controls={sidebarOpen ? null : controls} />
            <OpenFolderError />
            <SessionView projectPath={projectPath} />
          </main>
        </div>
      )}
    </PluginsProvider>
  )
}
