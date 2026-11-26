import { FILE_LIST_LIMIT } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { ChangeFeed } from "./change-feed.ts"
import { limitFiles } from "../rules/file-list.ts"
import { FolderReader } from "./folder-reader.ts"
import { prefixed, projectFoldersOf, repositoriesIn } from "./repositories.ts"
import { gitFailed } from "./git-failed.ts"

export const listFiles = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const reader = yield* FolderReader
    const projectFolders = yield* projectFoldersOf(session)
    if (projectFolders !== null) {
      const paths: string[] = []
      for (const projectFolder of projectFolders) {
        const listed = yield* filesIn(sessionId, projectFolder.folder)
        for (const path of listed) paths.push(prefixed(projectFolder, path))
      }
      return limitFiles(paths, FILE_LIST_LIMIT)
    }
    const root = yield* reader.realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    const repositories = yield* repositoriesIn(session, root)
    if (repositories !== null) {
      const feed = yield* ChangeFeed
      const paths: string[] = []
      for (const repository of repositories) {
        const listed = yield* feed
          .listFiles(repository.folder)
          .pipe(Effect.mapError(gitFailed(sessionId)))
        for (const path of listed ?? []) paths.push(prefixed(repository, path))
      }
      return limitFiles(paths, FILE_LIST_LIMIT)
    }
    return limitFiles(yield* filesIn(sessionId, root), FILE_LIST_LIMIT)
  })

// Git's files, or outside a repository every file up to the limit.
const filesIn = (sessionId: string, folder: string) =>
  Effect.gen(function* () {
    const tracked = yield* (yield* ChangeFeed)
      .listFiles(folder)
      .pipe(Effect.mapError(gitFailed(sessionId)))
    return (
      tracked ??
      (yield* (yield* FolderReader)
        .walkFiles(folder, FILE_LIST_LIMIT)
        .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>)))
    )
  })
