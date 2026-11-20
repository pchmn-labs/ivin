import { holderOf } from "./branch-pick.ts"
import type { Branches, WorktreeEntry } from "./git-output.ts"

// Origin's branches only: a pick of another remote's branch would need its own tracking rule.
export const branchList = (branches: Branches, worktrees: readonly WorktreeEntry[]) => [
  ...branches.local.map((name) => ({
    name,
    remote: false,
    worktreePath: holderOf(name, worktrees)?.path ?? null,
  })),
  ...branches.remote
    .filter((name) => name.startsWith("origin/"))
    .map((name) => ({ name, remote: true, worktreePath: null })),
]
