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
