import {
  type Change,
  DIFF_SIZE_LIMIT,
  type FileDiff,
  PathOutsideWorkingFolder,
} from "@ivin/contracts/file"
import { Effect } from "effect"
import { type CommitRange, Git } from "../../worktree/usecases/git.ts"
import { parseDiff } from "../rules/diff.ts"
import { relativeNames } from "../rules/folder-path.ts"
import { gitFailed } from "./git-failed.ts"
import { sharedChangesOf } from "./list-changes.ts"

// The diff of `path` among `changes`, over the `range` they were listed in.
export const diffAmong = (
  sessionId: string,
  path: string,
  { root, changes, range }: { root: string; changes: ReadonlyArray<Change>; range: CommitRange },
) =>
  Effect.gen(function* () {
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const change = changes.find((candidate) => candidate.path === names.join("/"))
    if (change === undefined) return { kind: "unchanged" } satisfies FileDiff
    const output = yield* (yield* Git)
      .diffOf(root, change, DIFF_SIZE_LIMIT, range)
      .pipe(Effect.mapError(gitFailed(sessionId)))
    if (output === null) return { kind: "too_large" } satisfies FileDiff
    const diff = parseDiff(output)
    return (diff.kind === "text" ? { ...diff, status: change.status } : diff) satisfies FileDiff
  })

export const readDiff = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    if (relativeNames(path) === null)
      return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const { root, listing } = yield* sharedChangesOf(sessionId)
    if (listing === null) return { kind: "not_repository" } satisfies FileDiff
    return yield* diffAmong(sessionId, path, { root, ...listing })
  })
