import { Atom, AsyncResult } from "effect/reactivity"
import { getVersionAtom } from "./get-version.ts"

export interface Connection {
  readonly state: "connecting" | "connected" | "failed"
  readonly text: string
}

export const connectionAtom = Atom.readable((get): Connection =>
  AsyncResult.match(get(getVersionAtom), {
    onInitial: () => ({ state: "connecting", text: "Connecting to the server…" }),
    onFailure: () => ({
      state: "failed",
      text: "ivin's server is not answering. Quit and reopen ivin.",
    }),
    onSuccess: ({ value }) => ({ state: "connected", text: `ivin ${value}` }),
  }),
)
