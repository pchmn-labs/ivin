import type { FileContent, FileNotRead } from "@ivin/contracts/file"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { fileName } from "./file-name.ts"

export type FileReading =
  | { readonly kind: "text"; readonly text: string; readonly version: string }
  | { readonly kind: "image"; readonly src: string; readonly bytes: number }
  | { readonly kind: "message"; readonly text: string; readonly retryable: boolean }

const message = (text: string, retryable = false): FileReading => ({
  kind: "message",
  text,
  retryable,
})

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`

const base64Bytes = (data: string) =>
  (data.length * 3) / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0)

export const isSvgPath = (path: string): boolean => /\.svg$/i.test(path)

export const svgSource = (text: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`

export const imageNotShown = (path: string): string =>
  `${fileName(path)} cannot be shown: its data is damaged or in a format ivin cannot read.`

export const fileReading = (content: FileContent, path: string): FileReading => {
  const name = fileName(path)
  switch (content.kind) {
    case "text":
      return content
    case "image":
      return {
        kind: "image",
        src: `data:${content.mimeType};base64,${content.data}`,
        bytes: base64Bytes(content.data),
      }
    case "too_large":
      return message(
        `${name} is ${megabytes(content.size)}, over the ${megabytes(content.limit)} ivin shows, so it is not shown.`,
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
