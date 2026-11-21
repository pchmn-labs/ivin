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

// Above this size a file is not sent, so the window never receives one that would freeze it.
export const FILE_SIZE_LIMIT = 2 * 1024 * 1024

// `binary`: a zero byte among its first bytes.
export const FileContent = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("too_large"), size: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal("binary") }),
])
export type FileContent = typeof FileContent.Type

// `missing`: no file at that path, or a folder, while the working folder exists.
export class FileNotRead extends Schema.TaggedError<FileNotRead>()("FileNotRead", {
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
  // `path` as in `file.listFolder`.
  Rpc.make("file.readFile", {
    payload: { sessionId: Schema.String, path: Schema.String },
    success: FileContent,
    error: Schema.Union([
      SessionNotFound,
      WorkingFolderDeleted,
      PathOutsideWorkingFolder,
      FileNotRead,
    ]),
  }),
)
