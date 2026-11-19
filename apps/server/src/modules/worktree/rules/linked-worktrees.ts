import type { WorktreeEntry } from "./git-output.ts"

// Git lists the main worktree first; a prunable one has lost its folder.
export const linkedWorktrees = (projectPath: string, entries: readonly WorktreeEntry[]) =>
  entries
    .slice(1)
    .filter((entry) => !entry.prunable && entry.path !== projectPath)
    .map(({ path, branch }) => ({ path, branch }))
