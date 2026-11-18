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
