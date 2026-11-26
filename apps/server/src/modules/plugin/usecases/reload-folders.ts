import { Duration, Effect, Stream } from "effect"
import { PluginReloads } from "./plugin-reloads.ts"

const HOST_ANSWER_WITHIN = Duration.seconds(10)

// Swaps both halves of the plugins; with `wait`, returns once the plugin host has swapped or dropped theirs.
export const reloadFolders = (keys: ReadonlyArray<string>, wait: boolean) =>
  Effect.gen(function* () {
    const reloads = yield* PluginReloads
    const completed = yield* reloads.subscribeCompleted
    const pending = new Set(keys)
    for (const key of keys) yield* reloads.request(key, true)
    if (!wait) return
    yield* completed.pipe(
      Stream.takeUntil((key) => pending.delete(key) && pending.size === 0),
      Stream.runDrain,
      Effect.timeoutOption(HOST_ANSWER_WITHIN),
    )
  }).pipe(Effect.scoped)
