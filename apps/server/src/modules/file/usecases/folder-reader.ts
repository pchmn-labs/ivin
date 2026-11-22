import { Context, Data, type Effect } from "effect"

export class FolderUnreadable extends Data.TaggedError("FolderUnreadable")<{
  readonly reason: "missing" | "unreadable"
}> {}

export interface FolderName {
  readonly name: string
  readonly kind: "folder" | "file"
}

export class FolderReader extends Context.Service<
  FolderReader,
  {
    // Symlinks resolved; null when nothing is there.
    readonly realPath: (path: string) => Effect.Effect<string | null>
    // A symlink takes the kind of what it points to.
    readonly readEntries: (
      folder: string,
    ) => Effect.Effect<ReadonlyArray<FolderName>, FolderUnreadable>
    // Every file below `folder` but `.git`, without following symlinks; stops after `limit + 1` files.
    readonly walkFiles: (
      folder: string,
      limit: number,
    ) => Effect.Effect<ReadonlyArray<string>, FolderUnreadable>
  }
>()("ivin/server/FolderReader") {}
