import type { Branches, WorktreeEntry } from "./git-output.ts"

export type BranchPick =
  | { readonly kind: "unknown" }
  | { readonly kind: "current" }
  | { readonly kind: "checkout"; readonly branch: string }
  | { readonly kind: "track"; readonly remote: string; readonly branch: string }
  | { readonly kind: "move"; readonly path: string; readonly branch: string }

const ORIGIN = "origin/"

// A worktree whose folder is gone no longer holds its branch.
export const holderOf = (branch: string, worktrees: readonly WorktreeEntry[]) =>
  worktrees.find((w) => w.branch === branch && !w.prunable)

// Git refuses to check out a branch another worktree holds, so a pick resolves before calling it.
export const resolveBranchPick = (
  picked: { readonly name: string; readonly remote: boolean },
  {
    workingFolder,
    local,
    remote,
    worktrees,
  }: {
    readonly workingFolder: string
    readonly local: Branches["local"]
    readonly remote: Branches["remote"]
    readonly worktrees: readonly WorktreeEntry[]
  },
): BranchPick => {
  // Only a listed name reaches git, where a name such as `-f` would read as an option.
  if (!(picked.remote ? remote : local).includes(picked.name)) return { kind: "unknown" }
  const branch = picked.remote ? picked.name.slice(ORIGIN.length) : picked.name
  if (picked.remote && !local.includes(branch)) {
    return { kind: "track", remote: picked.name, branch }
  }
  const holder = holderOf(branch, worktrees)
  if (!holder) return { kind: "checkout", branch }
  if (holder.path === workingFolder) return { kind: "current" }
  return { kind: "move", path: holder.path, branch }
}
