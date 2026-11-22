import type {
  FolderRefusal,
  ShellCommandNotOurs,
  ShellFoldersRefused,
  ShellInstall,
} from "@ivin/contracts/cli"

const refusalText: Record<FolderRefusal, string> = {
  permissionDenied: "ivin is not allowed to write there",
  readOnly: "its disk is read-only",
  notAFolder: "it is a file, not a folder",
  unknown: "ivin could not write there",
}

const tagOf = (error: unknown) =>
  typeof error === "object" && error !== null && "_tag" in error ? error._tag : null

export const installFailureMessage = (error: unknown): string => {
  if (tagOf(error) === "ShellFoldersRefused") {
    const { folders } = error as ShellFoldersRefused
    return `Not installed. ${folders.map((f) => `${f.path}: ${refusalText[f.reason]}.`).join(" ")}`
  }
  if (tagOf(error) === "ShellCommandNotOurs") {
    const { path } = error as ShellCommandNotOurs
    return `Not installed: ${path} already exists and is not ivin's. Remove it, then try again.`
  }
  return "ivin was not installed in your shell."
}

export const pathHint = ({ folder, onPath }: ShellInstall): string | null =>
  onPath === false
    ? `${folder} is not on your shell's PATH: add it, then open a new terminal.`
    : null
