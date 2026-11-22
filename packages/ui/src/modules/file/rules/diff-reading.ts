import { DIFF_SIZE_LIMIT, type FileDiff, type GitFailed } from "@ivin/contracts/file"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "./file-name.ts"

export type DiffReading =
  | { readonly kind: "text"; readonly diff: Extract<FileDiff, { kind: "text" }> }
  | {
      readonly kind: "message"
      readonly text: string
      readonly retryable: boolean
      readonly gitMessage: string | null
    }

const message = (
  text: string,
  retryable = false,
  gitMessage: string | null = null,
): DiffReading => ({
  kind: "message",
  text,
  retryable,
  gitMessage,
})

export const diffReading = (diff: FileDiff, path: string): DiffReading => {
  const name = fileName(path)
  switch (diff.kind) {
    case "text":
      return { kind: "text", diff }
    case "binary":
      return message(`${name} is a binary file, so its diff is not shown.`)
    case "too_large":
      return message(
        `The diff of ${name} is over the ${DIFF_SIZE_LIMIT / (1024 * 1024)} MB ivin shows, so it is not shown.`,
      )
    case "unchanged":
      return message(`${name} has no uncommitted changes.`)
    case "not_repository":
      return message("This working folder is not in a git repository, so it has no diff to show.")
  }
}

export const diffReadingFailure = (error: unknown, path: string): DiffReading => {
  const name = fileName(path)
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return message("This session's working folder was deleted, so its diffs cannot be shown.")
    case "SessionNotFound":
      return message("This session no longer exists, so its diffs cannot be shown.")
    case "PathOutsideWorkingFolder":
      return message(`${path} is outside the session's working folder, so its diff is not shown.`)
    case "GitFailed":
      return message(
        `Git could not show the diff of ${name}. Fix what it reports, then retry.`,
        true,
        (error as GitFailed).gitMessage,
      )
    default:
      return message(`The diff of ${name} could not be read. Retry.`, true)
  }
}
