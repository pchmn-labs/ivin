import { Effect } from "effect"
import { worktreeBase } from "../rules/worktree-base.ts"
import { Git } from "./git.ts"

// Reads the refs as they are: a caller that wants origin's latest fetches first.
export const newWorktreeBase = (repo: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const hasOrigin = yield* git.hasRemote(repo, "origin")
    return worktreeBase({
      hasOrigin,
      originHead: hasOrigin ? yield* git.originHead(repo) : null,
      remote: hasOrigin ? (yield* git.listBranches(repo)).remote : [],
    })
  })
