import { Context, Data, type Effect, type Scope, type Stream } from "effect"

export class FolderWatchFailed extends Data.TaggedError("FolderWatchFailed")<{
  readonly message: string
}> {}

export class FolderWatcher extends Context.Service<
  FolderWatcher,
  {
    // Watching on return, until the scope closes. The paths are relative to `folder`; those `skip`
    // accepts never queue. The stream fails when the watcher breaks, such as a removed folder.
    readonly open: (
      folder: string,
      skip: (path: string) => boolean,
    ) => Effect.Effect<Stream.Stream<string, FolderWatchFailed>, FolderWatchFailed, Scope.Scope>
  }
>()("ivin/server/FolderWatcher") {}
