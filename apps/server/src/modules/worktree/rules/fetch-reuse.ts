export const WORKTREE_FETCH_REUSE_MS = 2 * 60 * 1000
export const BRANCH_LIST_FETCH_REUSE_MS = 60 * 1000

export const isFetchRecent = (lastFetchAt: number | undefined, now: number, reuseMs: number) =>
  lastFetchAt !== undefined && now - lastFetchAt < reuseMs
