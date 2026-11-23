import type { GitFailed } from "@ivin/contracts/file"
import type { DiscardFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "./file-name.ts"

export const discardFailure = (error: unknown, paths: ReadonlyArray<string>): DiscardFailure => {
  const what =
    paths.length === 1
      ? `the changes to ${fileName(paths[0] as string)}`
      : "the uncommitted changes"
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
