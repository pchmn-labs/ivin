import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Tooltip } from "../core/ui/tooltip/tooltip.tsx"
import { getCurrentProjectAtom } from "../modules/project/atoms/get-current-project.ts"
import {
  NoProject,
  OpenFolderError,
  ProjectRail,
  ProjectTitle,
} from "../modules/project/ui/project-picker.tsx"
import { SessionList } from "../modules/session/ui/session-list.tsx"
import { SessionView } from "../modules/session/ui/session-view.tsx"
import { PluginsProvider } from "./plugin-host.tsx"
import { builtinPlugins } from "./builtin-plugins.ts"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"
import "./app.css"

export function App() {
  const result = useAtomValue(getVersionAtom)
  const project = useAtomValue(getCurrentProjectAtom)
  const projectPath = AsyncResult.isSuccess(project) ? (project.value?.path ?? null) : null
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
      <div className={projectPath === null ? "iv-app iv-app--empty" : "iv-app"}>
        <ProjectRail footer={version} />
        {projectPath !== null && (
          <aside className="iv-app__sidebar">
            <ProjectTitle />
            <SessionList projectPath={projectPath} />
          </aside>
        )}
        <main className="iv-app__main">
          <OpenFolderError />
          {projectPath === null ? <NoProject /> : <SessionView projectPath={projectPath} />}
        </main>
      </div>
    </PluginsProvider>
  )
}
