import { FolderNotListed, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { sortEntries } from "../rules/folder-entries.ts"
import { isWithin, relativeNames } from "../rules/folder-path.ts"
import { FolderReader } from "./folder-reader.ts"

export const listFolder = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const reader = yield* FolderReader
    const root = yield* reader.realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    // Resolving the real path catches a symlink that points out of the working folder.
    const folder = yield* reader.realPath([root, ...names].join("/"))
    if (folder === null) return yield* new FolderNotListed({ sessionId, path, reason: "missing" })
    if (!isWithin(root, folder)) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const entries = (yield* reader
      .readEntries(folder)
      .pipe(
        Effect.mapError(({ reason }) => new FolderNotListed({ sessionId, path, reason })),
      )).filter((entry) => entry.name !== ".git")
    const ignored = yield* (yield* Git).ignoredNames(
      folder,
      entries.map((entry) => entry.name),
    )
    return sortEntries(entries.filter((entry) => !ignored.has(entry.name)))
  })
