import type { GitFailed } from "@ivin/contracts/file"
import type { ChangeListing } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

export const changeListingFailure = (error: unknown): ChangeListing => {
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return { kind: "deleted" }
    case "SessionNotFound":
      return {
        kind: "failed",
        failure: {
          text: "This session no longer exists, so it has no changes to show.",
          retryable: false,
        },
        gitMessage: null,
      }
    case "GitFailed":
      return {
        kind: "failed",
        failure: {
          text: "Git could not list the changes. Fix what it reports, then retry.",
          retryable: true,
        },
        gitMessage: (error as GitFailed).gitMessage,
      }
    default:
      return {
        kind: "failed",
        failure: { text: "The changes could not be listed. Retry.", retryable: true },
        gitMessage: null,
      }
  }
}
