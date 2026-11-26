import { FileNotRead, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { isWithin, relativeNames } from "../rules/folder-path.ts"
import { FolderReader } from "./folder-reader.ts"
import { readContent } from "./read-content.ts"
import { folderOfNames } from "./repositories.ts"

export const readFile = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const resolved = yield* folderOfNames(session, names)
    if (resolved === null) return yield* new FileNotRead({ sessionId, path, reason: "missing" })
    const { root } = resolved
    // Resolving the real path catches a symlink that points out of the working folder.
    const file = yield* (yield* FolderReader).realPath([root, ...resolved.names].join("/"))
    if (file === null) return yield* new FileNotRead({ sessionId, path, reason: "missing" })
    if (!isWithin(root, file)) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    return yield* readContent(sessionId, path, file)
  })
