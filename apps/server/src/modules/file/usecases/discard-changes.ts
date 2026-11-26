import { PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { relativeNames } from "../rules/folder-path.ts"
import { repositoryOfPath, sessionRoot } from "./repositories.ts"
import { gitFailed } from "./git-failed.ts"
import { changesOf } from "./list-changes.ts"

export const discardChanges = (sessionId: string, paths: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const wanted = new Set<string>()
    for (const path of paths) {
      const names = relativeNames(path)
      if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
      wanted.add(names.join("/"))
    }
    const { repositories } = yield* sessionRoot(sessionId)
    if (repositories !== null) {
      for (const repository of repositories) {
        const own = new Set<string>()
        for (const path of wanted) {
          const inside = repositoryOfPath([repository], path)
          if (inside !== null) own.add(inside.path)
        }
        if (own.size === 0) continue
        const listing = yield* (yield* Git)
          .listChanges(repository.folder)
          .pipe(Effect.mapError(gitFailed(sessionId)))
        const discarded = (listing?.changes ?? []).filter((change) => own.has(change.path))
        if (discarded.length > 0) {
          yield* (yield* Git)
            .discard(repository.folder, discarded)
            .pipe(Effect.mapError(gitFailed(sessionId)))
        }
      }
      return
    }
    const { root, listing } = yield* changesOf(sessionId)
    const discarded = (listing?.changes ?? []).filter((change) => wanted.has(change.path))
    if (discarded.length === 0) return
    yield* (yield* Git).discard(root, discarded).pipe(Effect.mapError(gitFailed(sessionId)))
  })
