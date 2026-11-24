import { FileNotRead, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { isWithin, relativeNames } from "../rules/folder-path.ts"
import { FolderReader } from "./folder-reader.ts"
import { readContent } from "./read-content.ts"

export const readFile = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const folders = yield* FolderReader
    const root = yield* folders.realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    // Resolving the real path catches a symlink that points out of the working folder.
    const file = yield* folders.realPath([root, ...names].join("/"))
    if (file === null) return yield* new FileNotRead({ sessionId, path, reason: "missing" })
    if (!isWithin(root, file)) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    return yield* readContent(sessionId, path, file)
  })
