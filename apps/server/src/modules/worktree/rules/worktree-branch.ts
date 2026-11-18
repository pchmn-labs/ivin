export const branchFor = (requested: string | null, sessionId: string) => {
  const trimmed = requested?.trim() ?? ""
  return trimmed === "" ? `ivin/${sessionId.slice(0, 8)}` : trimmed
}

export const worktreePath = (repo: string, branch: string) =>
  `${repo.replace(/\/+$/, "")}/.worktrees/${branch.replaceAll("/", "-")}`
