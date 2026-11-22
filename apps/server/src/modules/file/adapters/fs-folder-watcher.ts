import { Cause, Effect, Layer, Queue, Stream } from "effect"
import { watch } from "node:fs"
import { FolderWatcher, FolderWatchFailed } from "../usecases/folder-watcher.ts"

const failed = (error: unknown) =>
  new FolderWatchFailed({ message: error instanceof Error ? error.message : String(error) })

export const layerFsFolderWatcher = Layer.succeed(FolderWatcher)({
  open: (folder) =>
    Effect.gen(function* () {
      const paths = yield* Queue.unbounded<string, FolderWatchFailed | Cause.Done>()
      yield* Effect.acquireRelease(
        Effect.try({
          try: () =>
            watch(folder, { recursive: true }, (_, name) => {
              if (name !== null) Queue.offerUnsafe(paths, name)
            }).on("error", (error) => Queue.failCauseUnsafe(paths, Cause.fail(failed(error)))),
          catch: failed,
        }),
        (watcher) => Effect.sync(() => watcher.close()),
      )
      return Stream.fromQueue(paths)
    }),
})
