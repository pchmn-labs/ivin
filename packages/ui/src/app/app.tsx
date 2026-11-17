import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { serverVersionAtom } from "./server-version-atom.ts"

export function App() {
  const result = useAtomValue(serverVersionAtom)
  return (
    <main>
      <h1>ivin</h1>
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
