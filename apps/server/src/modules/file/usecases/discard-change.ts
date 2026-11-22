import { PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { relativeNames } from "../rules/folder-path.ts"
import { gitFailed } from "./git-failed.ts"
import { changesOf } from "./list-changes.ts"

export const discardChange = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const { root, changes } = yield* changesOf(sessionId)
    const change = changes?.find((candidate) => candidate.path === names.join("/"))
    if (change === undefined) return
    yield* (yield* Git).discard(root, [change]).pipe(Effect.mapError(gitFailed(sessionId)))
  })

export const discardAllChanges = (sessionId: string) =>
  Effect.gen(function* () {
    const { root, changes } = yield* changesOf(sessionId)
    if (changes === null || changes.length === 0) return
    yield* (yield* Git).discard(root, changes).pipe(Effect.mapError(gitFailed(sessionId)))
  })
