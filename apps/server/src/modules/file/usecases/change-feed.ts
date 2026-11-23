import type { FolderChange } from "@ivin/contracts/file"
import { Context, Effect, Fiber, Layer, type Scope, Stream } from "effect"
import { type ChangeListing, Git, type GitError } from "../../worktree/usecases/git.ts"
import { isWithin } from "../rules/folder-path.ts"
import { ancestorsOf, isGitStateChange, isIgnoreFile, isUnderGit } from "../rules/watched-paths.ts"
import { SharedFolderWatch } from "./shared-folder-watch.ts"
import { makeSharedStreams } from "./shared-streams.ts"

const BATCH_WINDOW = "100 millis"
const BATCH_SIZE = 50_000

interface Listed {
  readonly batch: number
  readonly fiber: Fiber.Fiber<ChangeListing | null, GitError>
}

export class ChangeFeed extends Context.Service<
  ChangeFeed,
  {
    // The changes in the working folder at real path `root` that git does not ignore, one feed
    // per folder shared by every reader.
    readonly subscribe: (
      root: string,
    ) => Effect.Effect<Stream.Stream<FolderChange>, never, Scope.Scope>
    // `Git.listChanges`, run once per batch of the feed while it has a reader.
    readonly listChanges: (root: string) => Effect.Effect<ChangeListing | null, GitError>
  }
>()("ivin/server/ChangeFeed") {}

export const layerChangeFeed = Layer.effect(ChangeFeed)(
  Effect.gen(function* () {
    const git = yield* Git
    const folders = yield* SharedFolderWatch
    const scope = yield* Effect.scope
    // Global, so a listing of a closed feed never matches a batch of the one opened after it.
    let lastBatch = 0
    const batches = new Map<string, number>()
    const listings = new Map<string, Listed>()

    const watchFolderAt = (folder: string) =>
      folders.subscribe(folder).pipe(
        Effect.tapError((error) => Effect.logWarning(`could not watch ${folder}`, error)),
        Effect.orElseSucceed((): Stream.Stream<string> => Stream.empty),
      )

    const open = (root: string) =>
      Effect.gen(function* () {
        const raw = yield* watchFolderAt(root)
        const gitDir = yield* git.gitDir(root)
        // A linked worktree keeps its HEAD and index outside the working folder.
        const gitRaw =
          gitDir === null || isWithin(root, gitDir)
            ? Stream.empty
            : (yield* watchFolderAt(gitDir)).pipe(Stream.map((path) => `.git/${path}`))
        batches.set(root, ++lastBatch)
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            batches.delete(root)
            listings.delete(root)
          }),
        )

        // Folders found ignored: a change under one costs no git call.
        const ignoredFolders = new Set<string>()
        const withoutIgnored = (paths: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            const covered = (path: string) =>
              ancestorsOf(path).some((name) => ignoredFolders.has(name))
            const pending = paths.filter((path) => !covered(path))
            if (pending.length === 0) return []
            const ignored = yield* git.ignoredNames(root, [
              ...new Set(pending.flatMap(ancestorsOf)),
            ])
            for (const path of pending)
              for (const name of ancestorsOf(path))
                if (name !== path && ignored.has(name)) ignoredFolders.add(name)
            return pending.filter((path) => !ancestorsOf(path).some((name) => ignored.has(name)))
          })

        const changeOf = (batch: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            const paths = [...new Set(batch)]
            if (paths.some(isIgnoreFile)) ignoredFolders.clear()
            const kept = yield* withoutIgnored(paths.filter((path) => !isUnderGit(path)))
            return kept.length > 0 || paths.some(isGitStateChange)
              ? ([{ paths: kept }] satisfies FolderChange[])
              : []
          })

        return Stream.merge(raw, gitRaw).pipe(
          Stream.groupedWithin(BATCH_SIZE, BATCH_WINDOW),
          Stream.mapEffect(changeOf),
          Stream.flattenIterable,
          // Before any reader gets the batch, so a listing it asks for next is new.
          Stream.tap(() => Effect.sync(() => batches.set(root, ++lastBatch))),
        )
      })

    const feeds = makeSharedStreams(open)

    return {
      subscribe: feeds.subscribe,
      listChanges: (root) =>
        Effect.gen(function* () {
          const batch = batches.get(root)
          if (batch === undefined) return yield* git.listChanges(root)
          let listed = listings.get(root)
          if (listed?.batch !== batch) {
            // Forked, so a reader that leaves does not interrupt the others waiting on it.
            const fiber = yield* git.listChanges(root).pipe(Effect.forkIn(scope))
            listed = { batch, fiber }
            listings.set(root, listed)
          }
          const { fiber } = listed
          return yield* Fiber.join(fiber).pipe(
            Effect.tapError(() =>
              Effect.sync(() => listings.get(root)?.fiber === fiber && listings.delete(root)),
            ),
          )
        }),
    }
  }),
)
