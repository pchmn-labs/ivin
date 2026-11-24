import type { CommittedChangeListing } from "@ivin/plugin-api/ui"

export const FOLDER_DELETED =
  "This session's working folder was deleted, so it has no changes to show."

export const committedMessage = (listing: CommittedChangeListing): string | null => {
  switch (listing.kind) {
    case "no_origin":
      return "This repository has no origin remote, so the branch's commits cannot be listed."
    case "no_default_branch":
      return "Git does not know origin's default branch, so the branch's commits cannot be listed. Run git remote set-head origin --auto."
    case "no_merge_base":
      return "The branch shares no commit with origin's default branch, so its commits cannot be listed."
    case "listed":
      return listing.changes.length === 0 ? `No committed changes since ${listing.base}.` : null
    default:
      return null
  }
}

export interface EmptyMessages {
  readonly uncommitted: string | null
  readonly committed: string | null
}

export const emptyMessages = (
  uncommitted: number,
  committed: CommittedChangeListing,
): EmptyMessages => {
  if (uncommitted > 0) return { uncommitted: null, committed: committedMessage(committed) }
  // Waiting for the commits keeps a sentence from being swapped for another as they arrive.
  if (committed.kind === "loading") return { uncommitted: null, committed: null }
  if (committed.kind === "listed" && committed.changes.length === 0)
    return {
      uncommitted: `No changes since ${committed.base}. What the agent changes shows up here.`,
      committed: null,
    }
  return {
    uncommitted: "No uncommitted changes. What the agent changes shows up here.",
    committed: committedMessage(committed),
  }
}
