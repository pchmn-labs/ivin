import type { Change, ChangeStatus } from "@ivin/contracts/file"

const statusOf = (letter: string): ChangeStatus => {
  if (letter === "A") return "added"
  if (letter === "D") return "deleted"
  if (letter === "R") return "renamed"
  return "modified"
}

const countOf = (field: string) => (field === "-" ? null : Number(field))

// `nameStatus` is `git diff --name-status -z -M`, `numstat` the same diff's `--numstat -z -M`,
// `untracked` is `git ls-files --others -z`.
export const parseChanges = (
  nameStatus: string,
  numstat: string,
  untracked: string,
): ReadonlyArray<Change> => {
  const counts = new Map<string, { added: number | null; deleted: number | null }>()
  const stats = numstat.split("\0")
  for (let index = 0; index < stats.length; index++) {
    const [added = "", deleted = "", path = ""] = (stats[index] as string).split("\t")
    if (added === "") continue
    // A rename leaves the path empty and carries its old and new paths as the next fields.
    const key = path === "" ? (stats[(index += 2)] ?? "") : path
    counts.set(key, { added: countOf(added), deleted: countOf(deleted) })
  }

  const changes: Change[] = []
  const fields = nameStatus.split("\0")
  for (let index = 0; index + 1 < fields.length; index++) {
    const letter = (fields[index] as string).charAt(0)
    if (letter === "") continue
    const status = statusOf(letter)
    const previousPath = status === "renamed" || letter === "C" ? (fields[++index] as string) : null
    const path = fields[++index] as string
    const { added = null, deleted = null } = counts.get(path) ?? {}
    changes.push({
      path,
      previousPath: status === "renamed" ? previousPath : null,
      status,
      added,
      deleted,
    })
  }
  for (const path of untracked.split("\0"))
    if (path !== "")
      changes.push({ path, previousPath: null, status: "untracked", added: null, deleted: null })

  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}
