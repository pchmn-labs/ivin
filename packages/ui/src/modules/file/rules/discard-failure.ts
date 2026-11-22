import type { GitFailed } from "@ivin/contracts/file"
import type { DiscardFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "./file-name.ts"

// `path` null for all the uncommitted changes at once.
export const discardFailure = (error: unknown, path: string | null): DiscardFailure => {
  const what = path === null ? "the uncommitted changes" : `the changes to ${fileName(path)}`
  switch (errorTag(error)) {
    case "SessionNotFound":
      return {
        text: "This session no longer exists, so its changes cannot be discarded.",
        retryable: false,
        gitMessage: null,
      }
    case "WorkingFolderDeleted":
      return {
        text: "This session's working folder was deleted, so its changes cannot be discarded.",
        retryable: false,
        gitMessage: null,
      }
    case "GitFailed":
      return {
        text: `Git could not discard ${what}. Fix what it reports, then discard again.`,
        retryable: true,
        gitMessage: (error as GitFailed).gitMessage,
      }
    default:
      return {
        text: `${what.charAt(0).toUpperCase()}${what.slice(1)} could not be discarded. Discard again.`,
        retryable: true,
        gitMessage: null,
      }
  }
}
