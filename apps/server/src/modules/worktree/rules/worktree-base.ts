const FETCH_REUSE_MS = 2 * 60 * 1000

// Null when origin's default branch cannot be found.
export const worktreeBase = ({
  hasOrigin,
  originHead,
  remote,
}: {
  readonly hasOrigin: boolean
  readonly originHead: string | null
  readonly remote: readonly string[]
}): string | null => {
  if (!hasOrigin) return "HEAD"
  if (originHead !== null) return originHead
  return ["origin/main", "origin/master"].find((name) => remote.includes(name)) ?? null
}

export const isFetchRecent = (lastFetchAt: number | undefined, now: number) =>
  lastFetchAt !== undefined && now - lastFetchAt < FETCH_REUSE_MS
