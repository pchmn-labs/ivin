import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "../../file/rules/file-name.ts"

export const openFileFailure = (error: unknown, path: string): ActionFailure =>
  errorTag(error) === "SessionNotFound"
    ? { text: "This session no longer exists, so its files cannot be opened.", retryable: false }
    : {
        text: `${fileName(path)} could not be opened. Retry.`,
        retryable: true,
      }

export const openDiffFailure = (error: unknown, path: string): ActionFailure =>
  errorTag(error) === "SessionNotFound"
    ? { text: "This session no longer exists, so its diffs cannot be opened.", retryable: false }
    : { text: `The diff of ${fileName(path)} could not be opened. Retry.`, retryable: true }

export const closeFileFailure = (path: string): string =>
  `${fileName(path)} could not be closed. Retry.`

export const switchModeFailure = (fullWidth: boolean): string =>
  fullWidth
    ? "This tab could not switch to full width. Retry."
    : "This tab could not go back beside the chat. Retry."

export const selectSessionTabFailure = "The Session tab could not be selected. Retry."
