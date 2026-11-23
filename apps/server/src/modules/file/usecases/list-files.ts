import { FILE_LIST_LIMIT } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { ChangeFeed } from "./change-feed.ts"
import { limitFiles } from "../rules/file-list.ts"
import { FolderReader } from "./folder-reader.ts"
import { gitFailed } from "./git-failed.ts"

export const listFiles = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const reader = yield* FolderReader
    const root = yield* reader.realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    const tracked = yield* (yield* ChangeFeed)
      .listFiles(root)
      .pipe(Effect.mapError(gitFailed(sessionId)))
    const paths =
      tracked ??
      (yield* reader
        .walkFiles(root, FILE_LIST_LIMIT)
        .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>)))
    return limitFiles(paths, FILE_LIST_LIMIT)
  })
