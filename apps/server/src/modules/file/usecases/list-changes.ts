import type { Change, ChangeList } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { ChangeFeed } from "./change-feed.ts"
import { FolderReader } from "./folder-reader.ts"
import { gitFailed } from "./git-failed.ts"
import { prefixChange, sessionRoot } from "./repositories.ts"

export const rootOf = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const root = yield* (yield* FolderReader).realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    return root
  })

// The listing of the latest batch of the folder's changes, which a reader of the batch shares.
export const sharedChangesOf = (sessionId: string) =>
  Effect.gen(function* () {
    const root = yield* rootOf(sessionId)
    const listing = yield* (yield* ChangeFeed)
      .listChanges(root)
      .pipe(Effect.mapError(gitFailed(sessionId)))
    return { root, listing }
  })

// Never shared: a discard acts on what is on disk now.
export const changesOf = (sessionId: string) =>
  Effect.gen(function* () {
    const root = yield* rootOf(sessionId)
    const listing = yield* (yield* Git)
      .listChanges(root)
      .pipe(Effect.mapError(gitFailed(sessionId)))
    return { root, listing }
  })

export const listChanges = (sessionId: string) =>
  Effect.gen(function* () {
    const { repositories } = yield* sessionRoot(sessionId)
    if (repositories === null) return yield* listRepositoryChanges(sessionId)
    if (repositories.length === 0) return { kind: "not_repository" } satisfies ChangeList
    const feed = yield* ChangeFeed
    const changes: Change[] = []
    for (const repository of repositories) {
      const listing = yield* feed
        .listChanges(repository.folder)
        .pipe(Effect.mapError(gitFailed(sessionId)))
      for (const change of listing?.changes ?? []) changes.push(prefixChange(repository, change))
    }
    return {
      kind: "listed",
      changes,
      repositories: repositories.map((repository) => repository.name),
    } satisfies ChangeList
  })

const listRepositoryChanges = (sessionId: string) =>
  sharedChangesOf(sessionId).pipe(
    Effect.map(({ listing }): ChangeList =>
      listing === null ? { kind: "not_repository" } : { kind: "listed", changes: listing.changes },
    ),
  )
