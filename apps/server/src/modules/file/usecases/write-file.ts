import { FileChangedOnDisk, FileNotWritten, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { isWithin, relativeNames } from "../rules/folder-path.ts"
import { contentVersion } from "./content-version.ts"
import { FileReader } from "./file-reader.ts"
import { FileWriter } from "./file-writer.ts"
import { FolderReader } from "./folder-reader.ts"
import { folderOfNames } from "./repositories.ts"

export const writeFile = (
  sessionId: string,
  path: string,
  text: string,
  expectedVersion: string | null,
) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const relative = relativeNames(path)
    if (relative === null || relative.length === 0)
      return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const folders = yield* FolderReader
    const resolved = yield* folderOfNames(session, relative)
    if (resolved === null) return yield* new FileNotWritten({ sessionId, path, reason: "missing" })
    const { root, names } = resolved
    if (names.length === 0) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const existing = yield* folders.realPath([root, ...names].join("/"))
    const parent = yield* folders.realPath([root, ...names.slice(0, -1)].join("/"))
    const file = existing ?? (parent === null ? null : `${parent}/${names.at(-1)}`)
    if (file === null) return yield* new FileNotWritten({ sessionId, path, reason: "missing" })
    if (!isWithin(root, file)) return yield* new PathOutsideWorkingFolder({ sessionId, path })

    if (expectedVersion !== null) {
      const onDisk = yield* (yield* FileReader).read(file).pipe(
        Effect.flatMap(contentVersion),
        Effect.orElseSucceed(() => null),
      )
      if (onDisk !== expectedVersion) return yield* new FileChangedOnDisk({ sessionId, path })
    }
    const bytes = new TextEncoder().encode(text)
    yield* (yield* FileWriter)
      .write(file, bytes)
      .pipe(Effect.mapError(({ reason }) => new FileNotWritten({ sessionId, path, reason })))
    return { version: yield* contentVersion(bytes) }
  })
