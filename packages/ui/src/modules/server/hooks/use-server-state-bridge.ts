import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import type { ServerState } from "../../../core/desktop-bridge.ts"
import { makeServerClientLayer, serverClientLayerAtom } from "../../../core/server-client.ts"
import { getServerState, onServerState } from "../adapters/desktop-server.ts"
import { serverStateAtom } from "../atoms/server-state.ts"

export function useServerStateBridge() {
  const registry = useContext(RegistryContext)
  useEffect(() => {
    let previous: ServerState["kind"] = "running"
    const apply = (state: ServerState) => {
      registry.set(serverStateAtom, state)
      // The old client talks to a stopped server: the restarted one needs a new port.
      if (state.kind === "running" && previous !== "running") {
        registry.set(serverClientLayerAtom, makeServerClientLayer())
      }
      previous = state.kind
    }
    const stop = onServerState(apply)
    void getServerState().then(apply)
    return stop
  }, [registry])
}
