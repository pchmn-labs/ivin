import type { GitStatusEntry } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { FolderReader } from "./folder-reader.ts"
import { gitFailed } from "./git-failed.ts"
import { prefixStatus, repositoriesIn } from "./repositories.ts"

export const readGitStatus = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const root = yield* (yield* FolderReader).realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    const git = yield* Git
    const repositories = yield* repositoriesIn(session, root)
    if (repositories === null) {
      return yield* git.statusOf(root).pipe(Effect.mapError(gitFailed(sessionId)))
    }
    const entries: GitStatusEntry[] = []
    for (const repository of repositories) {
      const status = yield* git
        .statusOf(repository.folder)
        .pipe(Effect.mapError(gitFailed(sessionId)))
      for (const entry of status) entries.push(prefixStatus(repository, entry))
    }
    return entries
  })
