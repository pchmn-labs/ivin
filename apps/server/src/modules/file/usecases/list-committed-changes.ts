import type { Change, CommittedChangeList } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Context, Effect, Layer } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { type CommitRange, Git, type Tips } from "../../worktree/usecases/git.ts"
import { FolderReader } from "./folder-reader.ts"
import { gitFailed } from "./git-failed.ts"

type Unlisted = Exclude<CommittedChangeList, { kind: "listed" }>

export type CommittedListing =
  | Unlisted
  | {
      readonly kind: "listed"
      readonly root: string
      readonly base: string
      readonly range: CommitRange
      readonly changes: ReadonlyArray<Change>
    }

const FOLDERS_KEPT = 32

export class CommittedListings extends Context.Service<
  CommittedListings,
  {
    // The last listing of each of the folders read most recently, with the tips it was read at.
    readonly get: (root: string, tips: Tips) => CommittedListing | null
    readonly set: (root: string, tips: Tips, listing: CommittedListing) => void
  }
>()("ivin/server/CommittedListings") {}

const keyOf = ({ head, base, target }: Tips) => `${head} ${base} ${target}`

export const layerCommittedListings = Layer.sync(CommittedListings)(() => {
  const listings = new Map<string, { readonly key: string; readonly listing: CommittedListing }>()
  return {
    get: (root, tips) => {
      const kept = listings.get(root)
      if (kept?.key !== keyOf(tips)) return null
      listings.delete(root)
      listings.set(root, kept)
      return kept.listing
    },
    set: (root, tips, listing) => {
      listings.delete(root)
      listings.set(root, { key: keyOf(tips), listing })
      for (const oldest of listings.keys()) {
        if (listings.size <= FOLDERS_KEPT) break
        listings.delete(oldest)
      }
    },
  }
})

const unlisted = (kind: Unlisted["kind"]) => ({ kind }) as const

const listBetween = (sessionId: string, root: string, head: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    if ((yield* git.gitDir(root)) === null) return unlisted("not_repository")
    const failed = gitFailed(sessionId)
    if (!(yield* git.hasRemote(root, "origin").pipe(Effect.mapError(failed))))
      return unlisted("no_origin")
    const base = yield* git.originHead(root)
    if (base === null) return unlisted("no_default_branch")
    if (!(yield* git.hasCommit(root)))
      return { kind: "listed", root, base, range: { from: head }, changes: [] } as const
    const mergeBase = yield* git.mergeBase(root, base).pipe(Effect.mapError(failed))
    if (mergeBase === null) return unlisted("no_merge_base")
    const listing = yield* git
      .listChanges(root, { from: mergeBase, to: head })
      .pipe(Effect.mapError(failed))
    if (listing === null) return unlisted("not_repository")
    return { kind: "listed", root, base, ...listing } as const
  })

export const committedChangesOf = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const root = yield* (yield* FolderReader).realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    const tips = yield* (yield* Git).tips(root)
    if (tips === null) return yield* listBetween(sessionId, root, "HEAD")
    const cache = yield* CommittedListings
    const kept = cache.get(root, tips)
    if (kept !== null) return kept
    const listing: CommittedListing = yield* listBetween(sessionId, root, tips.head)
    // These depend only on the two commits; the others on the remote's config.
    if (listing.kind === "listed" || listing.kind === "no_merge_base")
      cache.set(root, tips, listing)
    return listing
  })

export const listCommittedChanges = (sessionId: string) =>
  committedChangesOf(sessionId).pipe(
    Effect.map((listing): CommittedChangeList =>
      listing.kind === "listed"
        ? { kind: "listed", base: listing.base, changes: listing.changes }
        : listing,
    ),
  )
