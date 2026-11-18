import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
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
  const version = (
    <span data-testid="server-version">
      {AsyncResult.match(result, {
        onInitial: () => "Connecting to the server…",
        onFailure: () => "The server did not answer",
        onSuccess: ({ value }) => `Server ${value}`,
      })}
    </span>
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
