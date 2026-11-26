import type { Change, CommittedChangeList } from "@ivin/contracts/file"
import { Context, Effect, Layer } from "effect"
import { type CommitRange, Git, type Tips } from "../../worktree/usecases/git.ts"
import { gitFailed } from "./git-failed.ts"
import { rootOf } from "./list-changes.ts"
import { prefixChange, sessionRoot } from "./repositories.ts"

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

const keyOf = ({ head, base, baseCommit }: Tips) => `${head} ${base} ${baseCommit}`

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

export const committedChangesIn = (sessionId: string, root: string) =>
  Effect.gen(function* () {
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

export const committedChangesOf = (sessionId: string) =>
  rootOf(sessionId).pipe(Effect.flatMap((root) => committedChangesIn(sessionId, root)))

const listRepositoryCommittedChanges = (sessionId: string) =>
  committedChangesOf(sessionId).pipe(
    Effect.map((listing): CommittedChangeList =>
      listing.kind === "listed"
        ? { kind: "listed", base: listing.base, changes: listing.changes }
        : listing,
    ),
  )

export const listCommittedChanges = (sessionId: string) =>
  Effect.gen(function* () {
    const { repositories } = yield* sessionRoot(sessionId)
    if (repositories === null) return yield* listRepositoryCommittedChanges(sessionId)
    const listings = []
    for (const repository of repositories) {
      listings.push({
        repository,
        listing: yield* committedChangesIn(sessionId, repository.folder),
      })
    }
    const listed = listings.flatMap(({ repository, listing }) =>
      listing.kind === "listed" ? [{ repository, listing }] : [],
    )
    if (listed.length === 0) return listings[0]?.listing ?? ({ kind: "not_repository" } as const)
    return {
      kind: "listed",
      base: [...new Set(listed.map(({ listing }) => listing.base))].join(" and "),
      changes: listed
        .flatMap(({ repository, listing }) =>
          listing.changes.map((change) => prefixChange(repository, change)),
        )
        .sort((a, b) => a.path.localeCompare(b.path)),
    } satisfies CommittedChangeList
  })
