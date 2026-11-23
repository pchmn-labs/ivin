import type { Branches, WorktreeEntry } from "./git-output.ts"

export type BranchPick =
  | { readonly kind: "unlisted" }
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
    branches,
    worktrees,
  }: {
    readonly workingFolder: string
    readonly branches: Branches
    readonly worktrees: readonly WorktreeEntry[]
  },
): BranchPick => {
  const listed = picked.remote
    ? picked.name.startsWith(ORIGIN) && branches.remote.includes(picked.name)
    : branches.local.includes(picked.name)
  // git would read a name such as `-f` as an option, and a ref can be made with one.
  if (!listed || picked.name.startsWith("-")) return { kind: "unlisted" }
  const { local } = branches
  const branch = picked.remote ? picked.name.slice(ORIGIN.length) : picked.name
  if (picked.remote && !local.includes(branch)) {
    return { kind: "track", remote: picked.name, branch }
  }
  const holder = holderOf(branch, worktrees)
  if (!holder) return { kind: "checkout", branch }
  if (holder.path === workingFolder) return { kind: "current" }
  return { kind: "move", path: holder.path, branch }
}
