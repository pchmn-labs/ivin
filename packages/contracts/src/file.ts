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

// `renamed`: a rename git sees in the index; an unstaged one is a `deleted` and an `untracked` file.
// A conflicted file is `modified`.
export const ChangeStatus = Schema.Literals([
  "modified",
  "added",
  "deleted",
  "renamed",
  "untracked",
])
export type ChangeStatus = typeof ChangeStatus.Type

// `added` and `deleted` count lines, null for a binary or an untracked file.
export const Change = Schema.Struct({
  path: Schema.String,
  previousPath: Schema.NullOr(Schema.String),
  status: ChangeStatus,
  added: Schema.NullOr(Schema.Number),
  deleted: Schema.NullOr(Schema.Number),
})
export type Change = typeof Change.Type

export const ChangeList = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("listed"), changes: Schema.Array(Change) }),
  Schema.Struct({ kind: Schema.Literal("not_repository") }),
])
export type ChangeList = typeof ChangeList.Type

// `changed`: the part of the line that differs from the line it replaces or is replaced by.
export const DiffLine = Schema.Struct({
  kind: Schema.Literals(["context", "added", "deleted"]),
  text: Schema.String,
  oldLine: Schema.NullOr(Schema.Number),
  newLine: Schema.NullOr(Schema.Number),
  changed: Schema.NullOr(Schema.Tuple([Schema.Number, Schema.Number])),
})
export type DiffLine = typeof DiffLine.Type

export const DiffHunk = Schema.Struct({ header: Schema.String, lines: Schema.Array(DiffLine) })
export type DiffHunk = typeof DiffHunk.Type

export const DIFF_SIZE_LIMIT = 4 * 1024 * 1024

// `unchanged`: the file no longer has uncommitted changes.
export const FileDiff = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("text"),
    hunks: Schema.Array(DiffHunk),
    added: Schema.Number,
    deleted: Schema.Number,
  }),
  Schema.Struct({ kind: Schema.Literal("binary") }),
  Schema.Struct({ kind: Schema.Literal("too_large") }),
  Schema.Struct({ kind: Schema.Literal("unchanged") }),
  Schema.Struct({ kind: Schema.Literal("not_repository") }),
])
export type FileDiff = typeof FileDiff.Type

// `gitMessage` is git's own output, which the user fixes the repository from.
export class GitFailed extends Schema.TaggedError<GitFailed>()("GitFailed", {
  sessionId: Schema.String,
  gitMessage: Schema.String,
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
  // The working folder's uncommitted changes against HEAD, untracked files included, sorted by path,
  // with paths in the form of `file.listFolder`.
  Rpc.make("file.listChanges", {
    payload: { sessionId: Schema.String },
    success: ChangeList,
    error: Schema.Union([SessionNotFound, WorkingFolderDeleted, GitFailed]),
  }),
  // The uncommitted diff of one path `file.listChanges` lists, against HEAD.
  Rpc.make("file.readDiff", {
    payload: { sessionId: Schema.String, path: Schema.String },
    success: FileDiff,
    error: Schema.Union([
      SessionNotFound,
      WorkingFolderDeleted,
      PathOutsideWorkingFolder,
      GitFailed,
    ]),
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
