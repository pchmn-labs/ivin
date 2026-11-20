export interface WorktreeEntry {
  readonly path: string
  // Null on a detached HEAD.
  readonly branch: string | null
  readonly prunable: boolean
}

export interface Branches {
  readonly local: readonly string[]
  readonly remote: readonly string[]
}

const HEADS = "refs/heads/"
const REMOTES = "refs/remotes/"

// Reads `git worktree list --porcelain`.
export const parseWorktreeList = (output: string): WorktreeEntry[] =>
  output
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line !== ""))
    .filter((lines) => lines[0]?.startsWith("worktree ") === true)
    .map((lines) => {
      const value = (key: string) =>
        lines.find((line) => line === key || line.startsWith(`${key} `))?.slice(key.length + 1)
      const ref = value("branch")
      return {
        path: value("worktree") ?? "",
        branch: ref?.startsWith(HEADS) === true ? ref.slice(HEADS.length) : null,
        prunable: value("prunable") !== undefined,
      }
    })

// Reads `git for-each-ref --format=%(refname) refs/heads refs/remotes`.
export const parseBranches = (output: string): Branches => {
  const refs = output.split("\n").filter((line) => line !== "")
  return {
    local: refs.filter((ref) => ref.startsWith(HEADS)).map((ref) => ref.slice(HEADS.length)),
    remote: refs
      .filter((ref) => ref.startsWith(REMOTES) && !ref.endsWith("/HEAD"))
      .map((ref) => ref.slice(REMOTES.length)),
  }
}

// Reads `git rev-list --left-right --count <branch>...<upstream>`.
export const parseDivergence = (output: string) => {
  const [ahead = 0, behind = 0] = output.trim().split(/\s+/).map(Number)
  return { ahead, behind }
}
// Git prints resolved paths; a repository opened through a symlink keeps the path it was opened with.
export const underOpenedPath = (
  entries: readonly WorktreeEntry[],
  opened: string,
  resolved: string,
): WorktreeEntry[] =>
  entries.map((entry) =>
    entry.path === resolved || entry.path.startsWith(`${resolved}/`)
      ? { ...entry, path: opened + entry.path.slice(resolved.length) }
      : entry,
  )

// Reads `git patch-id --stable`: one `<patch id> <commit>` line per patch.
export const parsePatchIds = (output: string) =>
  output
    .split("\n")
    .map((line) => line.split(" ")[0] ?? "")
    .filter((id) => id !== "")
