import { Effect } from "effect"
import { defaultBranchName, fastForwardCount } from "../rules/checkout-sync.ts"
import { Git } from "./git.ts"
import { listWorktrees } from "./list-worktrees.ts"
import { newWorktreeBase } from "./new-worktree-base.ts"
import { fetchOriginQuietly } from "./fetch-origin-quietly.ts"

export const checkoutStatus = (projectPath: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    yield* fetchOriginQuietly(projectPath)
    const branch = yield* git.currentBranch(projectPath)
    const defaultBranch = defaultBranchName(yield* newWorktreeBase(projectPath))
    const worktrees = yield* listWorktrees(projectPath)
    const behind =
      branch === null
        ? 0
        : yield* git.divergence(projectPath, branch, `origin/${branch}`).pipe(
            Effect.map(fastForwardCount),
            // No `origin/<branch>`: nothing to fast-forward from.
            Effect.orElseSucceed(() => 0),
          )
    return {
      branch,
      defaultBranch,
      defaultBranchInWorktree:
        defaultBranch !== null && worktrees.some((worktree) => worktree.branch === defaultBranch),
      behind,
    }
  })
