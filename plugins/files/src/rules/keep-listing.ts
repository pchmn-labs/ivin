import type { FileListing } from "@ivin/plugin-api/ui"

// `current` when `next` says the same, so what reads the listing sees no new value.
export const keepListing = (current: FileListing | null, next: FileListing): FileListing => {
  if (current === null || current.kind !== next.kind) return next
  if (current.kind === "listed" && next.kind === "listed")
    return current.truncated === next.truncated && sameOrder(current.paths, next.paths)
      ? current
      : next
  if (current.kind === "failed" && next.kind === "failed")
    return current.failure.text === next.failure.text &&
      current.failure.retryable === next.failure.retryable
      ? current
      : next
  return current
}

const sameOrder = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((path, at) => path === b[at])
