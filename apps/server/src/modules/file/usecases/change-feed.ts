import type { FolderChange } from "@ivin/contracts/file"
import { Context, Effect, Fiber, Layer, type Scope, Stream } from "effect"
import { type ChangeListing, Git, type GitError } from "../../worktree/usecases/git.ts"
import { isWithin } from "../rules/folder-path.ts"
import { ancestorsOf, isGitStateChange, isIgnoreFile, isUnderGit } from "../rules/watched-paths.ts"
import { FolderReader } from "./folder-reader.ts"
import { SharedFolderWatch } from "./shared-folder-watch.ts"
import { makeSharedStreams } from "./shared-streams.ts"

const BATCH_WINDOW = "100 millis"
const BATCH_SIZE = 50_000

interface Feed {
  batch: number
  // Counts the batches after which the folder's file list may differ.
  files: number
}

interface ListedFiles {
  readonly generation: number
  readonly fiber: Fiber.Fiber<ReadonlyArray<string> | null, GitError>
  // Null while the listing runs, and outside a repository.
  readonly known: { current: KnownFiles | null }
}

interface KnownFiles {
  readonly files: ReadonlySet<string>
  readonly folders: ReadonlySet<string>
}

// Above this, checking each path on disk costs more than listing again.
const MAX_PATHS_CHECKED = 500

interface Listed {
  readonly batch: number
  readonly fiber: Fiber.Fiber<ChangeListing | null, GitError>
}

const knownFiles = (paths: ReadonlyArray<string>): KnownFiles => {
  const folders = new Set<string>()
  for (const path of paths) {
    for (let at = path.indexOf("/"); at !== -1; at = path.indexOf("/", at + 1))
      folders.add(path.slice(0, at))
  }
  return { files: new Set(paths), folders }
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
    // `Git.listFiles`, run again only after a batch that created or deleted a file or changed an
    // ignore file, and shared by every reader of the batch.
    readonly listFiles: (root: string) => Effect.Effect<ReadonlyArray<string> | null, GitError>
  }
>()("ivin/server/ChangeFeed") {}

export const layerChangeFeed = Layer.effect(ChangeFeed)(
  Effect.gen(function* () {
    const git = yield* Git
    const folders = yield* SharedFolderWatch
    const reader = yield* FolderReader
    const scope = yield* Effect.scope
    // Global, so a listing of a closed feed never matches a batch of the one opened after it.
    let lastBatch = 0
    const feedsByRoot = new Map<string, Feed>()
    const listings = new Map<string, Listed>()
    const fileListings = new Map<string, ListedFiles>()

    const watchFolderAt = (folder: string, skip?: (path: string) => boolean) =>
      folders.subscribe(folder, skip).pipe(
        Effect.tapError((error) => Effect.logWarning(`could not watch ${folder}`, error)),
        Effect.orElseSucceed((): Stream.Stream<string> => Stream.empty),
      )

    const open = (root: string) =>
      Effect.gen(function* () {
        const gitDir = yield* git.gitDir(root)
        // Folders found ignored: a change under one costs no git call.
        const ignoredFolders = new Set<string>()
        const isCovered = (path: string) =>
          ancestorsOf(path).some((name) => ignoredFolders.has(name))
        const raw = yield* watchFolderAt(root, isCovered)
        // A linked worktree keeps its HEAD and index outside the working folder.
        const gitRaw =
          gitDir === null || isWithin(root, gitDir)
            ? Stream.empty
            : (yield* watchFolderAt(gitDir)).pipe(Stream.map((path) => `.git/${path}`))
        const feed: Feed = { batch: ++lastBatch, files: 0 }
        feedsByRoot.set(root, feed)
        const end = Effect.sync(() => {
          if (feedsByRoot.get(root) !== feed) return
          feedsByRoot.delete(root)
          listings.delete(root)
          fileListings.delete(root)
        })
        yield* Effect.addFinalizer(() => end)

        const withoutIgnored = (paths: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            // Outside a repository nothing is ignored, `node_modules` included.
            if (gitDir === null) return paths
            const pending = paths.filter((path) => !isCovered(path))
            if (pending.length === 0) return []
            const ignored = yield* git.ignoredNames(root, [
              ...new Set(pending.flatMap(ancestorsOf)),
            ])
            for (const path of pending)
              for (const name of ancestorsOf(path))
                if (name !== path && ignored.has(name)) ignoredFolders.add(name)
            return pending.filter((path) => !ancestorsOf(path).some((name) => ignored.has(name)))
          })

        const changesFileList = (paths: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            const listed = fileListings.get(root)
            if (listed === undefined) return false
            if (paths.some((path) => isIgnoreFile(path) || isGitStateChange(path))) return true
            const known = listed.known.current
            if (known === null) return true
            const files = paths.filter((path) => !isUnderGit(path))
            if (files.length > MAX_PATHS_CHECKED) return true
            const moved = yield* Effect.forEach(
              files,
              (path) =>
                reader.realPath(`${root}/${path}`).pipe(
                  Effect.map((found) => {
                    const listedBefore = known.files.has(path) || known.folders.has(path)
                    return listedBefore !== (found !== null)
                  }),
                ),
              { concurrency: 16 },
            )
            return moved.some(Boolean)
          })

        const changeOf = (batch: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            const paths = [...new Set(batch)]
            if (paths.some(isIgnoreFile)) ignoredFolders.clear()
            const kept = yield* withoutIgnored(paths.filter((path) => !isUnderGit(path)))
            if (yield* changesFileList([...kept, ...paths.filter(isUnderGit)])) feed.files++
            return kept.length > 0 || paths.some(isGitStateChange)
              ? ([{ paths: kept }] satisfies FolderChange[])
              : []
          })

        return Stream.merge(raw, gitRaw).pipe(
          Stream.groupedWithin(BATCH_SIZE, BATCH_WINDOW),
          Stream.mapEffect(changeOf),
          Stream.flattenIterable,
          // Before any reader gets the batch, so a listing it asks for next is new.
          Stream.tap(() => Effect.sync(() => (feed.batch = ++lastBatch))),
          // A feed that ended sends no batch, so its last listing would never be read again.
          Stream.ensuring(end),
        )
      })

    const feeds = makeSharedStreams(open)

    return {
      subscribe: feeds.subscribe,
      listFiles: (root) =>
        Effect.gen(function* () {
          const feed = feedsByRoot.get(root)
          if (feed === undefined) return yield* git.listFiles(root)
          let listed = fileListings.get(root)
          if (listed?.generation !== feed.files) {
            const known: ListedFiles["known"] = { current: null }
            const fiber = yield* git.listFiles(root).pipe(
              Effect.tap((paths) =>
                Effect.sync(() => {
                  if (paths !== null) known.current = knownFiles(paths)
                }),
              ),
              // Forked, so a reader that leaves does not interrupt the others waiting on it.
              Effect.forkIn(scope),
            )
            listed = { generation: feed.files, fiber, known }
            fileListings.set(root, listed)
          }
          const { fiber } = listed
          return yield* Fiber.join(fiber).pipe(
            Effect.tapError(() =>
              Effect.sync(
                () => fileListings.get(root)?.fiber === fiber && fileListings.delete(root),
              ),
            ),
          )
        }),
      listChanges: (root) =>
        Effect.gen(function* () {
          const batch = feedsByRoot.get(root)?.batch
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
