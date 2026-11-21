import type { FolderEntry } from "@ivin/contracts/file"
import { Context, Data, type Effect } from "effect"

export class FolderUnreadable extends Data.TaggedError("FolderUnreadable")<{
  readonly reason: "missing" | "unreadable"
}> {}

export class FolderReader extends Context.Service<
  FolderReader,
  {
    // Symlinks resolved; null when nothing is there.
    readonly realPath: (path: string) => Effect.Effect<string | null>
    // A symlink takes the kind of what it points to.
    readonly readEntries: (
      folder: string,
    ) => Effect.Effect<ReadonlyArray<FolderEntry>, FolderUnreadable>
  }
>()("ivin/server/FolderReader") {}
