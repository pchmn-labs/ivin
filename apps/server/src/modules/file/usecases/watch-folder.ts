import type { FolderChange } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect, Stream } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { isWithin } from "../rules/folder-path.ts"
import { ancestorsOf, isGitStateChange, isIgnoreFile, isUnderGit } from "../rules/watched-paths.ts"
import { FolderReader } from "./folder-reader.ts"
import { SharedFolderWatch } from "./shared-folder-watch.ts"

const BATCH_WINDOW = "100 millis"
const BATCH_SIZE = 50_000

export const watchFolder = (sessionId: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (session === null) return yield* new SessionNotFound({ sessionId })
      const root = yield* (yield* FolderReader).realPath(session.workingFolder)
      if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
      const git = yield* Git
      const shared = yield* SharedFolderWatch
      const watchFolderAt = (folder: string) =>
        shared.subscribe(folder).pipe(
          Effect.tapError((error) => Effect.logWarning(`could not watch ${folder}`, error)),
          Effect.orElseSucceed((): Stream.Stream<string> => Stream.empty),
        )
      const raw = yield* watchFolderAt(root)
      const gitDir = yield* git.gitDir(root)
      // A linked worktree keeps its HEAD and index outside the working folder.
      const gitRaw =
        gitDir === null || isWithin(root, gitDir)
          ? Stream.empty
          : (yield* watchFolderAt(gitDir)).pipe(Stream.map((path) => `.git/${path}`))

      // Folders found ignored: a change under one costs no git call.
      const ignoredFolders = new Set<string>()
      const withoutIgnored = (paths: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const covered = (path: string) =>
            ancestorsOf(path).some((name) => ignoredFolders.has(name))
          const pending = paths.filter((path) => !covered(path))
          if (pending.length === 0) return []
          const ignored = yield* git.ignoredNames(root, [...new Set(pending.flatMap(ancestorsOf))])
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
      )
    }),
  )
