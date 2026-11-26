import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"

const BUILTIN_PREFIX = "builtin\0"

// The name a built-in plugin, which has no folder, goes by in a reload request.
export const builtinKey = (id: string) => `${BUILTIN_PREFIX}${id}`
export const builtinKeyId = (key: string) =>
  key.startsWith(BUILTIN_PREFIX) ? key.slice(BUILTIN_PREFIX.length) : null

export interface ReloadRequest {
  // The name of a plugin's folder, or `builtinKey(id)`.
  readonly folder: string
  // Swap the running half even when its compiled file is the one already running.
  readonly force: boolean
}

export interface PluginReloadsService {
  readonly request: (folder: string, force?: boolean) => Effect.Effect<void>
  // Subscribed on return, so a request made after it is not missed.
  readonly subscribe: Effect.Effect<Stream.Stream<ReloadRequest>, never, Scope.Scope>
  // The plugin host says it has swapped (or dropped) the plugin's server half.
  readonly complete: (folder: string) => Effect.Effect<void>
  readonly subscribeCompleted: Effect.Effect<Stream.Stream<string>, never, Scope.Scope>
}

export class PluginReloads extends Context.Service<PluginReloads, PluginReloadsService>()(
  "ivin/server/PluginReloads",
) {}

export const layerPluginReloads = Layer.effect(PluginReloads)(
  Effect.gen(function* () {
    const requests = yield* PubSub.unbounded<ReloadRequest>()
    const completions = yield* PubSub.unbounded<string>()
    const subscribeTo = <A>(bus: PubSub.PubSub<A>) =>
      Effect.map(PubSub.subscribe(bus), (subscription) => Stream.fromSubscription(subscription))
    return {
      request: (folder, force = false) =>
        PubSub.publish(requests, { folder, force }).pipe(Effect.asVoid),
      subscribe: subscribeTo(requests),
      complete: (folder) => PubSub.publish(completions, folder).pipe(Effect.asVoid),
      subscribeCompleted: subscribeTo(completions),
    }
  }),
)
