import type { PluginHalfState } from "@ivin/contracts/plugin"
import { Context, Effect, Layer } from "effect"

export interface ServerHalvesService {
  readonly set: (id: string, state: PluginHalfState) => Effect.Effect<void>
  readonly get: (id: string) => Effect.Effect<PluginHalfState | undefined>
}

export class ServerHalves extends Context.Service<ServerHalves, ServerHalvesService>()(
  "ivin/server/ServerHalves",
) {}

export const layerServerHalves = Layer.sync(ServerHalves)(() => {
  const states = new Map<string, PluginHalfState>()
  return {
    set: (id, state) => Effect.sync(() => void states.set(id, state)),
    get: (id) => Effect.sync(() => states.get(id)),
  }
})
