// A branch landed by a merge commit has its tip off `target`'s first-parent line.
export const hasOwnCommits = (
  head: string,
  mergeBase: string,
  targetFirstParents: readonly string[],
) => head !== mergeBase || !targetFirstParents.includes(head)

// `mergeTreeOutput` is null when the merge conflicts.
export const mergeAddsNothing = (mergeTreeOutput: string | null, targetTree: string) =>
  mergeTreeOutput?.split("\n")[0]?.trim() === targetTree

// One commit of the target carries the branch's whole diff, as a squash merge does.
export const isSquashMerged = (
  branchPatchIds: readonly string[],
  targetPatchIds: readonly string[],
) => branchPatchIds[0] !== undefined && targetPatchIds.includes(branchPatchIds[0])
