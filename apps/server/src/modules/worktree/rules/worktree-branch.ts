export const generatedBranch = (sessionId: string) => `ivin/${sessionId.slice(0, 8)}`

export const worktreePath = (repo: string, branch: string) =>
  `${repo.replace(/\/+$/, "")}/.worktrees/${branch.replaceAll("/", "-")}`

export const freeGeneratedBranch = (
  repo: string,
  sessionId: string,
  taken: { readonly branches: readonly string[]; readonly paths: readonly string[] },
) => {
  const first = generatedBranch(sessionId)
  for (let n = 1; ; n++) {
    const branch = n === 1 ? first : `${first}-${n}`
    const free =
      !taken.branches.includes(branch) && !taken.paths.includes(worktreePath(repo, branch))
    if (free) return branch
  }
}
