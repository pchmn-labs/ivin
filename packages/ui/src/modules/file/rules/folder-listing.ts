import type { FolderNotListed } from "@ivin/contracts/file"
import type { FolderListing } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

const failed = (text: string, retryable: boolean): FolderListing => ({
  kind: "failed",
  failure: { text, retryable },
})

// `path` is relative to the working folder, "" for the working folder itself.
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
