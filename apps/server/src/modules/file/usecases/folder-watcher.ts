import { Context, Data, type Effect, type Scope, type Stream } from "effect"

export class FolderWatchFailed extends Data.TaggedError("FolderWatchFailed")<{
  readonly message: string
}> {}

export class FolderWatcher extends Context.Service<
  FolderWatcher,
  {
    // Watching on return, until the scope closes. The paths are relative to `folder`, and those
    // `skip` accepts are dropped before they queue; a path waiting in the queue is sent once.
    // The stream fails when the watcher breaks, such as when the folder is removed.
    readonly open: (
      folder: string,
      skip: (path: string) => boolean,
    ) => Effect.Effect<Stream.Stream<string, FolderWatchFailed>, FolderWatchFailed, Scope.Scope>
  }
>()("ivin/server/FolderWatcher") {}
