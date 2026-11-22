import {
  DIFF_SIZE_LIMIT,
  type FileDiff,
  GitFailed,
  PathOutsideWorkingFolder,
} from "@ivin/contracts/file"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { parseDiff } from "../rules/diff.ts"
import { relativeNames } from "../rules/folder-path.ts"
import { changesOf } from "./list-changes.ts"

export const readDiff = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const { root, changes } = yield* changesOf(sessionId)
    if (changes === null) return { kind: "not_repository" } satisfies FileDiff
    const change = changes.find((candidate) => candidate.path === names.join("/"))
    if (change === undefined) return { kind: "unchanged" } satisfies FileDiff
    const output = yield* (yield* Git)
      .diffOf(root, change, DIFF_SIZE_LIMIT)
      .pipe(Effect.mapError(({ message }) => new GitFailed({ sessionId, gitMessage: message })))
    if (output === null) return { kind: "too_large" } satisfies FileDiff
    const diff = parseDiff(output)
    return (diff.kind === "text" ? { ...diff, status: change.status } : diff) satisfies FileDiff
  })
