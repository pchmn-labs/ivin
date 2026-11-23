import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect, Stream } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { ChangeFeed } from "./change-feed.ts"
import { FolderReader } from "./folder-reader.ts"

export const watchFolder = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (session === null) return yield* new SessionNotFound({ sessionId })
      const root = yield* (yield* FolderReader).realPath(session.workingFolder)
      if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
      return yield* (yield* ChangeFeed).subscribe(root)
    }),
  )
