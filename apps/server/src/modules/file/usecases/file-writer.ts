import { Context, Data, type Effect } from "effect"

export class FileUnwritable extends Data.TaggedError("FileUnwritable")<{
  readonly reason: "missing" | "unwritable"
}> {}

export class FileWriter extends Context.Service<
  FileWriter,
  {
    // Replaces the file at once, so no reader sees it half written; keeps its permissions.
    readonly write: (path: string, bytes: Uint8Array) => Effect.Effect<void, FileUnwritable>
  }
>()("ivin/server/FileWriter") {}
