import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

export const openFileFailure = (error: unknown, path: string): ActionFailure =>
  errorTag(error) === "SessionNotFound"
    ? { text: "This session no longer exists, so its files cannot be opened.", retryable: false }
    : {
        text: `${path.slice(path.lastIndexOf("/") + 1)} could not be opened. Retry.`,
        retryable: true,
      }

export const closeFileFailure = (path: string): string =>
  `${path.slice(path.lastIndexOf("/") + 1)} could not be closed. Try again.`
