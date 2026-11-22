import type { GitFileStatus, GitStatusEntry } from "@ivin/plugin-api/ui"

// A folder's mark: the first of these its files have.
const FOLDER_ORDER = ["conflicted", "modified", "untracked", "added"] as const

const asFolder = (status: GitFileStatus) => (status === "deleted" ? "modified" : status)

const pressing = (a: GitFileStatus | undefined, b: GitFileStatus) =>
  a === undefined || FOLDER_ORDER.indexOf(asFolder(b)) < FOLDER_ORDER.indexOf(asFolder(a))
    ? asFolder(b)
    : asFolder(a)

// Each changed file's status, and each folder above one the status that stands out among its files.
export const gitMarks = (
  entries: ReadonlyArray<GitStatusEntry>,
): ReadonlyMap<string, GitFileStatus> => {
  const marks = new Map<string, GitFileStatus>()
  for (const { path, status } of entries) {
    marks.set(path, status)
    for (let end = path.lastIndexOf("/"); end > 0; end = path.lastIndexOf("/", end - 1)) {
      const folder = path.slice(0, end)
      marks.set(folder, pressing(marks.get(folder), status))
    }
  }
  return marks
}
