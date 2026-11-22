import { Context, Effect, Layer, Semaphore, Stream, SubscriptionRef } from "effect"

export class SettingsFile extends Context.Service<
  SettingsFile,
  {
    readonly path: string
    // The file's text when watched, then after each change; null while it does not exist.
    readonly contents: Stream.Stream<string | null>
    readonly read: Effect.Effect<string | null>
    // Writes what `change` makes of the file's text, one edit at a time; a failure writes nothing.
    readonly edit: <E>(
      change: (text: string | null) => Effect.Effect<string, E>,
    ) => Effect.Effect<void, E>
  }
>()("ivin/server/SettingsFile") {}

// A file that goes through `texts`, then changes only through `edit`.
export const layerSettingsFileOf = (texts: ReadonlyArray<string | null>) =>
  Layer.effect(SettingsFile)(
    Effect.gen(function* () {
      const text = yield* SubscriptionRef.make(texts.at(-1) ?? null)
      const lock = yield* Semaphore.make(1)
      const changes = SubscriptionRef.changes(text)
      return {
        path: "/home/.ivin/settings.json",
        contents:
          texts.length === 0
            ? changes.pipe(Stream.drop(1))
            : Stream.fromIterable(texts.slice(0, -1)).pipe(Stream.concat(changes)),
        read: SubscriptionRef.get(text),
        edit: (change) =>
          lock.withPermits(1)(
            SubscriptionRef.get(text).pipe(
              Effect.flatMap(change),
              Effect.flatMap((next) => SubscriptionRef.set(text, next)),
            ),
          ),
      }
    }),
  )
