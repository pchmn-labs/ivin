import type { CommittedChangeList } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { FolderReader } from "./folder-reader.ts"
import { gitFailed } from "./git-failed.ts"

type Unlisted = Exclude<CommittedChangeList, { kind: "listed" }>

export const committedChangesOf = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const root = yield* (yield* FolderReader).realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    const git = yield* Git
    const unlisted = (kind: Unlisted["kind"]) => ({ kind }) as const
    if ((yield* git.gitDir(root)) === null) return unlisted("not_repository")
    const failed = gitFailed(sessionId)
    if (!(yield* git.hasRemote(root, "origin").pipe(Effect.mapError(failed))))
      return unlisted("no_origin")
    const base = yield* git.originHead(root)
    if (base === null) return unlisted("no_default_branch")
    const mergeBase = yield* git.mergeBase(root, base).pipe(Effect.mapError(failed))
    if (mergeBase === null) return unlisted("no_merge_base")
    const range = { from: mergeBase, to: "HEAD" }
    const changes = yield* git.listChanges(root, range).pipe(Effect.mapError(failed))
    if (changes === null) return unlisted("not_repository")
    return { kind: "listed", root, base, range, changes } as const
  })

export const listCommittedChanges = (sessionId: string) =>
  committedChangesOf(sessionId).pipe(
    Effect.map((listing): CommittedChangeList =>
      listing.kind === "listed"
        ? { kind: "listed", base: listing.base, changes: listing.changes }
        : listing,
    ),
  )
