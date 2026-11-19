import type { WorktreeEntry } from "./git-output.ts"

export const linkedWorktrees = (projectPath: string, entries: readonly WorktreeEntry[]) =>
  entries
    // Git lists the main worktree first.
    .slice(1)
    // A prunable worktree has lost its folder; a project opened on a worktree skips itself.
    .filter((entry) => !entry.prunable && entry.path !== projectPath)
    .map(({ path, branch }) => ({ path, branch }))
