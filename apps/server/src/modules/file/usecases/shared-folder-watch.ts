import { Context, Effect, Layer, type Scope, type Stream } from "effect"
import { FolderWatcher, type FolderWatchFailed } from "./folder-watcher.ts"
import { makeSharedStreams } from "./shared-streams.ts"

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
    return makeSharedStreams((folder) => watcher.open(folder))
  }),
)
