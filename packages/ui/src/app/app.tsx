import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { getCurrentProjectAtom } from "../modules/project/atoms/get-current-project.ts"
import { ProjectPicker } from "../modules/project/ui/project-picker.tsx"
import { SessionList } from "../modules/session/ui/session-list.tsx"
import { SessionView } from "../modules/session/ui/session-view.tsx"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"

export function App() {
  const result = useAtomValue(getVersionAtom)
  const project = useAtomValue(getCurrentProjectAtom)
  const projectPath = AsyncResult.isSuccess(project) ? (project.value?.path ?? null) : null
  return (
    <main>
      <h1>ivin</h1>
      <ProjectPicker />
      {projectPath !== null && (
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{ width: "16rem" }}>
            <SessionList projectPath={projectPath} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SessionView projectPath={projectPath} />
          </div>
        </div>
      )}
      <p data-testid="server-version">
        {AsyncResult.match(result, {
          onInitial: () => "Connecting to the server…",
          onFailure: () => "The server did not answer",
          onSuccess: ({ value }) => `Server ${value}`,
        })}
      </p>
    </main>
  )
}
