import type { FileNotWritten } from "@ivin/contracts/file"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import type { SaveFailure } from "./file-edit.ts"
import { fileName } from "./file-name.ts"

export const saveFailure = (error: unknown, path: string): SaveFailure => {
  const name = fileName(path)
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return {
        text: `This session's working folder was deleted, so ${name} cannot be saved.`,
        retryable: false,
      }
    case "SessionNotFound":
      return {
        text: `This session no longer exists, so ${name} cannot be saved.`,
        retryable: false,
      }
    case "PathOutsideWorkingFolder":
      return {
        text: `${path} is outside the session's working folder, so it is not saved.`,
        retryable: false,
      }
    case "FileNotWritten":
      return (error as FileNotWritten).reason === "missing"
        ? {
            text: `${name} was not saved: its folder no longer exists. Your edits are kept.`,
            retryable: true,
          }
        : {
            text: `${name} was not saved. Check its permissions, then retry. Your edits are kept.`,
            retryable: true,
          }
    default:
      return { text: `${name} was not saved. Retry. Your edits are kept.`, retryable: true }
  }
}
