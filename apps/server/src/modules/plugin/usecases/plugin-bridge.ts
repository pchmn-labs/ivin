import { CommandNotFound, type CommandFailed } from "@ivin/contracts/plugin"
import type { Session } from "@ivin/contracts/session"
import { Context, Effect, Layer, Queue, type Schema, SubscriptionRef } from "effect"

export type PluginEvent =
  | { readonly kind: "transcript"; readonly session: Session; readonly event: unknown }
  | { readonly kind: "sessionCreated"; readonly session: Session }

export type WatchedKind = PluginEvent["kind"]

export interface SpawnOutcome {
  readonly env: Readonly<Record<string, string>>
  // One line per hook that threw or ran over the limit, naming its plugin.
  readonly warnings: ReadonlyArray<string>
}

export const NO_SPAWN_CHANGE: SpawnOutcome = { env: {}, warnings: [] }

export interface PluginBridgeService {
  // Builds the event only when a plugin watches its kind.
  readonly publish: (kind: WatchedKind, build: Effect.Effect<PluginEvent>) => Effect.Effect<void>
  readonly events: Queue.Dequeue<PluginEvent>
  readonly watch: (kind: WatchedKind, watched: boolean) => void
  readonly windowVisible: SubscriptionRef.SubscriptionRef<boolean>
  readonly beforeSpawn: (sessionId: string) => Effect.Effect<SpawnOutcome>
  readonly runCommand: (
    command: string,
    args: Schema.Json,
  ) => Effect.Effect<Schema.Json, CommandNotFound | CommandFailed>
  // Set by the run that owns the plugin host while it is up, null when it is down.
  readonly connect: (
    runner: {
      readonly beforeSpawn: (sessionId: string) => Effect.Effect<SpawnOutcome>
      readonly runCommand: (
        command: string,
        args: Schema.Json,
      ) => Effect.Effect<Schema.Json, CommandNotFound | CommandFailed>
    } | null,
  ) => void
}

export class PluginBridge extends Context.Service<PluginBridge, PluginBridgeService>()(
  "ivin/server/PluginBridge",
) {}

const EVENT_BUFFER = 1024

export const layerPluginBridge = Layer.effect(PluginBridge)(
  Effect.gen(function* () {
    const events = yield* Queue.sliding<PluginEvent>(EVENT_BUFFER)
    const windowVisible = yield* SubscriptionRef.make(true)
    const watched = new Set<WatchedKind>()
    let runner: Parameters<PluginBridgeService["connect"]>[0] = null
    return {
      publish: (kind, build) =>
        Effect.suspend(() =>
          watched.has(kind)
            ? build.pipe(Effect.flatMap((event) => Queue.offer(events, event)))
            : Effect.void,
        ),
      events,
      watch: (kind, isWatched) => void (isWatched ? watched.add(kind) : watched.delete(kind)),
      windowVisible,
      beforeSpawn: (sessionId) =>
        Effect.suspend(() =>
          runner === null ? Effect.succeed(NO_SPAWN_CHANGE) : runner.beforeSpawn(sessionId),
        ),
      runCommand: (command, args) =>
        Effect.suspend(() =>
          runner === null
            ? Effect.fail(new CommandNotFound({ command }))
            : runner.runCommand(command, args),
        ),
      connect: (next) => void (runner = next),
    }
  }),
)
