import { Atom, AsyncResult } from "effect/reactivity"
import { getVersionAtom } from "./get-version.ts"
import { serverStateAtom } from "./server-state.ts"

export interface Connection {
  readonly state: "connecting" | "connected" | "restarting" | "failed"
  readonly text: string
  // Set when the user can ask the desktop app to start the server again.
  readonly canRestart?: boolean
}

export const connectionAtom = Atom.readable((get): Connection => {
  const server = get(serverStateAtom)
  if (server.kind === "restarting") {
    return { state: "restarting", text: "ivin's server stopped. Restarting it…" }
  }
  if (server.kind === "gave-up") {
    return {
      state: "failed",
      text: `ivin's server keeps stopping. Its log is at ${server.logPath}.`,
      canRestart: true,
    }
  }
  return AsyncResult.match(get(getVersionAtom), {
    onInitial: () => ({ state: "connecting", text: "Connecting to the server…" }),
    onFailure: () => ({
      state: "failed",
      text: "ivin's server is not answering. Quit and reopen ivin.",
    }),
    onSuccess: ({ value }) => ({ state: "connected", text: `ivin ${value}` }),
  })
})
