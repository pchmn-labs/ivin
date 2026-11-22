import { Context, Effect, Exit, Layer, PubSub, Scope, Semaphore, Stream } from "effect"
import { FolderWatcher, type FolderWatchFailed } from "./folder-watcher.ts"

interface Watch {
  readers: number
  ended: boolean
  // null ends the stream.
  readonly paths: PubSub.PubSub<string | null>
  readonly scope: Scope.Closeable
}

export class SharedFolderWatch extends Context.Service<
  SharedFolderWatch,
  {
    // One watcher per folder, opened with the first reader and closed with the last.
    readonly subscribe: (
      folder: string,
    ) => Effect.Effect<Stream.Stream<string>, FolderWatchFailed, Scope.Scope>
  }
>()("ivin/server/SharedFolderWatch") {}

export const layerSharedFolderWatch = Layer.effect(SharedFolderWatch)(
  Effect.gen(function* () {
    const watcher = yield* FolderWatcher
    const watches = new Map<string, Watch>()
    const lock = Semaphore.makeUnsafe(1)

    const start = (folder: string) =>
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const paths = yield* PubSub.unbounded<string | null>()
        const source = yield* watcher.open(folder).pipe(
          Effect.provideService(Scope.Scope, scope),
          Effect.onError(() => Scope.close(scope, Exit.void)),
        )
        const watch: Watch = { readers: 0, ended: false, paths, scope }
        yield* Stream.runForEach(source, (path) => PubSub.publish(paths, path)).pipe(
          Effect.catch((error) => Effect.logWarning(`stopped watching ${folder}`, error)),
          Effect.ensuring(
            Effect.suspend(() => {
              watch.ended = true
              if (watches.get(folder) === watch) watches.delete(folder)
              return PubSub.publish(paths, null)
            }),
          ),
          Effect.forkIn(scope),
        )
        return watch
      })

    const release = (folder: string, watch: Watch) =>
      lock.withPermits(1)(
        Effect.suspend(() => {
          if (--watch.readers > 0) return Effect.void
          if (watches.get(folder) === watch) watches.delete(folder)
          return Scope.close(watch.scope, Exit.void)
        }),
      )

    return {
      subscribe: (folder) =>
        lock.withPermits(1)(
          Effect.gen(function* () {
            let watch = watches.get(folder)
            if (watch === undefined) {
              watch = yield* start(folder)
              watches.set(folder, watch)
            }
            const joined = watch
            joined.readers++
            yield* Effect.addFinalizer(() => release(folder, joined))
            const subscription = yield* PubSub.subscribe(joined.paths)
            if (joined.ended) return Stream.empty
            return Stream.fromSubscription(subscription).pipe(
              Stream.takeWhile((path): path is string => path !== null),
            )
          }),
        ),
    }
  }),
)
