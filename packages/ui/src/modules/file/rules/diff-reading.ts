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

export type DiffKind = "diff" | "committed_diff"

const NO_ORIGIN = "This repository has no origin remote, so the branch's commits cannot be shown."
const NO_DEFAULT_BRANCH =
  "Git does not know origin's default branch, so the branch's commits cannot be shown. Run git remote set-head origin --auto."

export const diffReading = (diff: FileDiff, path: string, kind: DiffKind): DiffReading => {
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
      return message(
        kind === "diff"
          ? `${name} has no uncommitted changes.`
          : `The branch's commits did not change ${name}.`,
      )
    case "not_repository":
      return message("This working folder is not in a git repository, so it has no diff to show.")
    case "no_origin":
      return message(NO_ORIGIN)
    case "no_default_branch":
      return message(NO_DEFAULT_BRANCH)
    case "no_merge_base":
      return message(
        "The branch shares no commit with origin's default branch, so its commits cannot be shown.",
      )
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
