import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { SessionNotFound, WorkingFolderDeleted } from "./session.ts"

export const FolderEntry = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literals(["folder", "file"]),
  ignored: Schema.Boolean,
})
export type FolderEntry = typeof FolderEntry.Type

// `deleted`: tracked, and gone from the disk. A rename counts as `added` under its new path.
export const GitFileStatus = Schema.Literals([
  "modified",
  "added",
  "untracked",
  "deleted",
  "conflicted",
])
export type GitFileStatus = typeof GitFileStatus.Type

export const GitStatusEntry = Schema.Struct({ path: Schema.String, status: GitFileStatus })
export type GitStatusEntry = typeof GitStatusEntry.Type

export const FILE_LIST_LIMIT = 50_000

// `truncated`: the working folder holds more than `FILE_LIST_LIMIT` files, and only that many are listed.
export const FileList = Schema.Struct({
  paths: Schema.Array(Schema.String),
  truncated: Schema.Boolean,
})
export type FileList = typeof FileList.Type

// No paths: only git's own state changed, such as after a commit.
export const FolderChange = Schema.Struct({ paths: Schema.Array(Schema.String) })
export type FolderChange = typeof FolderChange.Type

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

export const FILE_SIZE_LIMIT = 2 * 1024 * 1024

// `binary`: a zero byte among its first bytes. `version` identifies the bytes read, for
// `file.writeFile` to tell whether the file changed since.
export const FileContent = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String, version: Schema.String }),
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

// The file on disk is no longer the version the write expected, or no longer exists.
export class FileChangedOnDisk extends Schema.TaggedError<FileChangedOnDisk>()(
  "FileChangedOnDisk",
  { sessionId: Schema.String, path: Schema.String },
) {}

// `missing`: its folder no longer exists, or the path is a folder.
export class FileNotWritten extends Schema.TaggedError<FileNotWritten>()("FileNotWritten", {
  sessionId: Schema.String,
  path: Schema.String,
  reason: Schema.Literals(["missing", "unwritable"]),
}) {}

export const FileRpcs = RpcGroup.make(
  // One level of a folder of the session's working folder, folders first; `path` is relative to
  // it, with `/` between names, and "" for the working folder itself. The `.git` folder is left out.
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
  // The working folder's files that git does not ignore, as paths in the form of `file.listFolder`.
  Rpc.make("file.listFiles", {
    payload: { sessionId: Schema.String },
    success: FileList,
    error: Schema.Union([SessionNotFound, WorkingFolderDeleted]),
  }),
  // The changed files inside the working folder, with paths in the form of `file.listFolder`;
  // none outside a git repository.
  Rpc.make("file.gitStatus", {
    payload: { sessionId: Schema.String },
    success: Schema.Array(GitStatusEntry),
    error: Schema.Union([SessionNotFound, WorkingFolderDeleted]),
  }),
  // The paths created, changed or deleted on disk, a batch at a time; what git ignores is left out.
  Rpc.make("file.watch", {
    payload: { sessionId: Schema.String },
    success: FolderChange,
    error: Schema.Union([SessionNotFound, WorkingFolderDeleted]),
    stream: true,
  }),
  // `path` as in `file.listFolder`. `expectedVersion` is the version `file.readFile` returned;
  // null writes whatever is on disk now.
  Rpc.make("file.writeFile", {
    payload: {
      sessionId: Schema.String,
      path: Schema.String,
      text: Schema.String,
      expectedVersion: Schema.NullOr(Schema.String),
    },
    success: Schema.Struct({ version: Schema.String }),
    error: Schema.Union([
      SessionNotFound,
      WorkingFolderDeleted,
      PathOutsideWorkingFolder,
      FileChangedOnDisk,
      FileNotWritten,
    ]),
  }),
)
