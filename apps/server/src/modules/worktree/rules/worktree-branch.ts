export const generatedBranch = (sessionId: string) => `ivin/${sessionId.slice(0, 8)}`

export const worktreePath = (repo: string, branch: string) =>
  `${repo.replace(/\/+$/, "")}/.worktrees/${branch.replaceAll("/", "-")}`
