import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect, Stream } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { ChangeFeed } from "./change-feed.ts"
import { FolderReader } from "./folder-reader.ts"
import { prefixed, projectFoldersOf } from "./repositories.ts"

export const watchFolder = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (session === null) return yield* new SessionNotFound({ sessionId })
      const reader = yield* FolderReader
      const feed = yield* ChangeFeed
      const projectFolders = yield* projectFoldersOf(session)
      if (projectFolders !== null) {
        const streams = []
        for (const projectFolder of projectFolders) {
          const root = yield* reader.realPath(projectFolder.folder)
          if (root === null) continue
          streams.push(
            (yield* feed.subscribe(root)).pipe(
              Stream.map((change) => ({
                paths: change.paths.map((path) => prefixed(projectFolder, path)),
              })),
            ),
          )
        }
        return Stream.mergeAll(streams, { concurrency: "unbounded" })
      }
      const root = yield* reader.realPath(session.workingFolder)
      if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
      return yield* feed.subscribe(root)
    }),
  )
