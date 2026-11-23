import type { FolderNotListed } from "@ivin/contracts/file"
import type { ActionFailure, FileListing, FolderListing } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

const failed = (text: string, retryable: boolean): Extract<FileListing, { kind: "failed" }> => ({
  kind: "failed",
  failure: { text, retryable },
})

export const folderListingFailure = (error: unknown, path: string): FolderListing => {
  const folder = path === "" ? "The working folder" : `The folder ${path}`
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return { kind: "deleted" }
    case "SessionNotFound":
      return failed("This session no longer exists, so its files cannot be listed.", false)
    case "PathOutsideWorkingFolder":
      return failed(
        `${folder} is outside the session's working folder, so it is not listed.`,
        false,
      )
    case "FolderNotListed":
      return (error as FolderNotListed).reason === "missing"
        ? failed(`${folder} no longer exists. Retry once it is back.`, true)
        : failed(`${folder} could not be read. Check its permissions, then retry.`, true)
    default:
      return failed(`${folder} could not be listed. Retry.`, true)
  }
}

export const gitStatusFailure = (error: unknown): ActionFailure | null => {
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
    case "SessionNotFound":
      return null
    default:
      return {
        text: "Git could not read which files changed, so the files show no status. Retry.",
        retryable: true,
      }
  }
}

export const fileListingFailure = (error: unknown): FileListing => {
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return { kind: "deleted" }
    case "SessionNotFound":
      return failed("This session no longer exists, so its files cannot be listed.", false)
    case "GitFailed":
      return failed("Git could not list the working folder's files. Retry.", true)
    default:
      return failed("The working folder's files could not be listed. Retry.", true)
  }
}
