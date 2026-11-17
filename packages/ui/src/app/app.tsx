import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { ProjectPicker } from "../modules/project/ui/project-picker.tsx"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"

export function App() {
  const result = useAtomValue(getVersionAtom)
  return (
    <main>
      <h1>ivin</h1>
      <ProjectPicker />
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
