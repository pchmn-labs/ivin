import {
  FILE_SIZE_LIMIT,
  type FileContent,
  FileNotRead,
  PathOutsideWorkingFolder,
} from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { isBinary } from "../rules/binary-content.ts"
import { isWithin, relativeNames } from "../rules/folder-path.ts"
import { contentVersion } from "./content-version.ts"
import { FileReader } from "./file-reader.ts"
import { FolderReader } from "./folder-reader.ts"

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
    const toError = ({ reason }: { reason: "missing" | "unreadable" }) =>
      new FileNotRead({ sessionId, path, reason })
    const reader = yield* FileReader
    const size = yield* reader.size(file).pipe(Effect.mapError(toError))
    if (size > FILE_SIZE_LIMIT) return { kind: "too_large", size } satisfies FileContent
    const bytes = yield* reader.read(file).pipe(Effect.mapError(toError))
    if (isBinary(bytes)) return { kind: "binary" } satisfies FileContent
    return {
      kind: "text",
      text: new TextDecoder().decode(bytes),
      version: yield* contentVersion(bytes),
    } satisfies FileContent
  })
