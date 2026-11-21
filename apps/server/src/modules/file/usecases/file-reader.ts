import { Context, Data, type Effect } from "effect"

export class FileUnreadable extends Data.TaggedError("FileUnreadable")<{
  readonly reason: "missing" | "unreadable"
}> {}

export class FileReader extends Context.Service<
  FileReader,
  {
    // A folder reads as `missing`, like nothing at all.
    readonly size: (path: string) => Effect.Effect<number, FileUnreadable>
    readonly read: (path: string) => Effect.Effect<Uint8Array, FileUnreadable>
  }
>()("ivin/server/FileReader") {}
