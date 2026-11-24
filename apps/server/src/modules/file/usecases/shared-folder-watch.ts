import { Context, Effect, Layer, type Scope, type Stream } from "effect"
import { FolderWatcher, type FolderWatchFailed } from "./folder-watcher.ts"
import { makeSharedStreams } from "./shared-streams.ts"

export class SharedFolderWatch extends Context.Service<
  SharedFolderWatch,
  {
    // One watcher per folder, opened with the first reader and closed with the last; the
    // latest `skip` passed for the folder applies.
    readonly subscribe: (
      folder: string,
      skip?: (path: string) => boolean,
    ) => Effect.Effect<Stream.Stream<string>, FolderWatchFailed, Scope.Scope>
  }
>()("ivin/server/SharedFolderWatch") {}

export const layerSharedFolderWatch = Layer.effect(SharedFolderWatch)(
  Effect.gen(function* () {
    const watcher = yield* FolderWatcher
    const skips = new Map<string, (path: string) => boolean>()
    const feeds = makeSharedStreams((folder) =>
      watcher.open(folder, (path) => skips.get(folder)?.(path) ?? false),
    )
    return {
      subscribe: (folder, skip) => {
        if (skip !== undefined) skips.set(folder, skip)
        return feeds.subscribe(folder)
      },
    }
  }),
)
