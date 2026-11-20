import type { Branches, WorktreeEntry } from "./git-output.ts"

export type BranchPick =
  | { readonly kind: "current" }
  | { readonly kind: "checkout"; readonly branch: string }
  | { readonly kind: "track"; readonly remote: string; readonly branch: string }
  | { readonly kind: "move"; readonly path: string; readonly branch: string }

const ORIGIN = "origin/"

// Git refuses to check out a branch another worktree holds, so a pick resolves before calling it.
export const resolveBranchPick = (
  picked: { readonly name: string; readonly remote: boolean },
  {
    workingFolder,
    local,
    worktrees,
  }: {
    readonly workingFolder: string
    readonly local: Branches["local"]
    readonly worktrees: readonly WorktreeEntry[]
  },
): BranchPick => {
  const branch = picked.remote ? picked.name.slice(ORIGIN.length) : picked.name
  if (picked.remote && !local.includes(branch)) {
    return { kind: "track", remote: picked.name, branch }
  }
  const holder = worktrees.find((w) => w.branch === branch && !w.prunable)
  if (!holder) return { kind: "checkout", branch }
  if (holder.path === workingFolder) return { kind: "current" }
  return { kind: "move", path: holder.path, branch }
}

// Origin's branches only: a pick of another remote's branch would need its own tracking rule.
export const branchList = (branches: Branches, worktrees: readonly WorktreeEntry[]) => [
  ...branches.local.map((name) => ({
    name,
    remote: false,
    worktreePath: worktrees.find((w) => w.branch === name && !w.prunable)?.path ?? null,
  })),
  ...branches.remote
    .filter((name) => name.startsWith(ORIGIN))
    .map((name) => ({ name, remote: true, worktreePath: null })),
]
