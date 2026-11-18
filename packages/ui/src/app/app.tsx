import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useCallback, useEffect, useState } from "react"
import { Tooltip } from "../core/components/tooltip/tooltip.tsx"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { ProjectColumn } from "../modules/project/ui/project-column.tsx"
import { ProjectRail } from "../modules/project/ui/project-rail.tsx"
import { NoProject, OpenFolderError } from "../modules/project/ui/no-project.tsx"
import { useReportUncaughtErrors } from "../modules/log/hooks/use-report-uncaught-errors.ts"
import { useRecordSessionVisits } from "../modules/session/hooks/use-session-history.ts"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import { PluginsProvider } from "./plugin-host.tsx"
import { builtinPlugins } from "./builtin-plugins.ts"
import { MainTopBar } from "./main-top-bar.tsx"
import { ShellControls } from "./shell-controls.tsx"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"
import "./app.css"

export function App() {
  const result = useAtomValue(getVersionAtom)
  const current = useAtomValue(selectedProjectAtom)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const projectPath = current?.path ?? null

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), [])
  useRecordSessionVisits()
  useReportUncaughtErrors()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleSidebar])

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

  return (
    <PluginsProvider plugins={builtinPlugins}>
      {current === null || projectPath === null ? (
        <div className="iv-app iv-app--empty">
          <main className="iv-app__main">
            <MainTopBar projectPath={null} controls={null} />
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
                <ShellControls
                  projectPath={projectPath}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={toggleSidebar}
                />
              </div>
              <div className="iv-app__card-body">
                <ProjectRail>{version}</ProjectRail>
                <ProjectColumn project={current} />
              </div>
            </aside>
          )}
          <main className="iv-app__main">
            <MainTopBar
              projectPath={projectPath}
              controls={
                sidebarOpen ? null : { projectPath, sidebarOpen, onToggleSidebar: toggleSidebar }
              }
            />
            <OpenFolderError />
            <TabView projectPath={projectPath} />
          </main>
        </div>
      )}
    </PluginsProvider>
  )
}
