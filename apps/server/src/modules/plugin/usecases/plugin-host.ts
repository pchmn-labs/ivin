import type {
  HostCall,
  HostDispatch,
  HostLog,
  HostReply,
  PluginActivateFailed,
  PluginHandlerFailed,
} from "@ivin/contracts/plugin"
import type { Effect, Schema, Scope, Stream } from "effect"
import { Context, Data } from "effect"

export class PluginHostNotStarted extends Data.TaggedError("PluginHostNotStarted")<{
  readonly reason: string
}> {}

export interface RunningPluginHost {
  readonly activate: (plugin: {
    readonly id: string
    readonly file: string
  }) => Effect.Effect<void, PluginActivateFailed>
  readonly deactivate: (id: string) => Effect.Effect<void>
  // Never answers while a plugin blocks the host.
  readonly ping: Effect.Effect<void>
  readonly logs: Stream.Stream<HostLog>
  // The `ctx` calls the plugins' halves make, until the process is gone.
  readonly calls: Stream.Stream<HostCall>
  readonly reply: (reply: HostReply) => Effect.Effect<void>
  readonly dispatch: (dispatch: HostDispatch) => Effect.Effect<Schema.Json, PluginHandlerFailed>
  // Ends with a reason when the process is gone.
  readonly exited: Effect.Effect<string>
}

export interface PluginHostLauncher {
  // Ready when it answers a ping; killed when the scope closes.
  readonly launch: Effect.Effect<RunningPluginHost, PluginHostNotStarted, Scope.Scope>
}

// Null when the server runs without a plugin host: no server half loads.
export const PluginHost = Context.Reference<PluginHostLauncher | null>("ivin/server/PluginHost", {
  defaultValue: () => null,
})
