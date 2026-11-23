import { PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { relativeNames } from "../rules/folder-path.ts"
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
    const { root, changes } = yield* changesOf(sessionId)
    const discarded = (changes ?? []).filter((change) => wanted.has(change.path))
    if (discarded.length === 0) return
    yield* (yield* Git).discard(root, discarded).pipe(Effect.mapError(gitFailed(sessionId)))
  })
