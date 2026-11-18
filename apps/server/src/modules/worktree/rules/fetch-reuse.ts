const FETCH_REUSE_MS = 2 * 60 * 1000

export const isFetchRecent = (lastFetchAt: number | undefined, now: number) =>
  lastFetchAt !== undefined && now - lastFetchAt < FETCH_REUSE_MS
