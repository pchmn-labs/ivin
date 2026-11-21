import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { SessionNotFound, WorkingFolderDeleted } from "./session.ts"

export const FolderEntry = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literals(["folder", "file"]),
})
export type FolderEntry = typeof FolderEntry.Type

// `path` as the client sent it, relative to the session's working folder.
export class PathOutsideWorkingFolder extends Schema.TaggedError<PathOutsideWorkingFolder>()(
  "PathOutsideWorkingFolder",
  { sessionId: Schema.String, path: Schema.String },
) {}

// `missing`: the folder no longer exists, while the working folder does.
export class FolderNotListed extends Schema.TaggedError<FolderNotListed>()("FolderNotListed", {
  sessionId: Schema.String,
  path: Schema.String,
  reason: Schema.Literals(["missing", "unreadable"]),
}) {}

export const FileRpcs = RpcGroup.make(
  // One level of a folder of the session's working folder, folders first; `path` is relative to
  // it, with `/` between names, and "" for the working folder itself. What git ignores is left out.
  Rpc.make("file.listFolder", {
    payload: { sessionId: Schema.String, path: Schema.String },
    success: Schema.Array(FolderEntry),
    error: Schema.Union([
      SessionNotFound,
      WorkingFolderDeleted,
      PathOutsideWorkingFolder,
      FolderNotListed,
    ]),
  }),
)
