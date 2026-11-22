import { FILE_SIZE_LIMIT, type FileContent, type FileNotRead } from "@ivin/contracts/file"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "./file-name.ts"

export type FileReading =
  | { readonly kind: "text"; readonly text: string; readonly version: string }
  | { readonly kind: "message"; readonly text: string; readonly retryable: boolean }

const message = (text: string, retryable = false): FileReading => ({
  kind: "message",
  text,
  retryable,
})

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`

export const fileReading = (content: FileContent, path: string): FileReading => {
  const name = fileName(path)
  switch (content.kind) {
    case "text":
      return content
    case "too_large":
      return message(
        `${name} is ${megabytes(content.size)}, over the ${megabytes(FILE_SIZE_LIMIT)} ivin shows, so it is not shown.`,
      )
    case "binary":
      return message(`${name} is a binary file, so it is not shown.`)
  }
}

export const fileReadingFailure = (error: unknown, path: string): FileReading => {
  const name = fileName(path)
  switch (errorTag(error)) {
    case "WorkingFolderDeleted":
      return message("This session's working folder was deleted, so its files cannot be shown.")
    case "SessionNotFound":
      return message("This session no longer exists, so its files cannot be shown.")
    case "PathOutsideWorkingFolder":
      return message(`${path} is outside the session's working folder, so it is not shown.`)
    case "FileNotRead":
      return (error as FileNotRead).reason === "missing"
        ? message(`${name} no longer exists. Retry once it is back.`, true)
        : message(`${name} could not be read. Check its permissions, then retry.`, true)
    default:
      return message(`${name} could not be opened. Retry.`, true)
  }
}
