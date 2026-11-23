import type { GitFileStatus, GitStatusEntry } from "@ivin/contracts/file"

const statusOf = (x: string, y: string): GitFileStatus => {
  if (x === "?" && y === "?") return "untracked"
  if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D"))
    return "conflicted"
  if (x === "D" || y === "D") return "deleted"
  if (x === "A" || x === "R" || x === "C") return "added"
  return "modified"
}

// `output` is `git status --porcelain=v1 -z`; `prefix` is the working folder's path from the repository root, "" or ending in `/`.
export const parseGitStatus = (output: string, prefix: string): ReadonlyArray<GitStatusEntry> => {
  const fields = output.split("\0")
  const entries: GitStatusEntry[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index] as string
    if (field.length < 4) continue
    const x = field[0] as string
    const y = field[1] as string
    const path = field.slice(3)
    // A rename or a copy carries its old path as the next field.
    if (x === "R" || x === "C" || y === "R" || y === "C") index++
    if (path.startsWith(prefix))
      entries.push({ path: path.slice(prefix.length), status: statusOf(x, y) })
  }
  return entries
}
