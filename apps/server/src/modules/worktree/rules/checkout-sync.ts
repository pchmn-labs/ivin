export interface Divergence {
  readonly ahead: number
  readonly behind: number
}

// Null without origin, where the base is `HEAD`.
export const defaultBranchName = (base: string | null) =>
  base?.startsWith("origin/") === true ? base.slice("origin/".length) : null

// Only a branch with no commit of its own can fast-forward.
export const fastForwardCount = ({ ahead, behind }: Divergence) => (ahead === 0 ? behind : 0)

// Git's wording for tracked ("Your local changes…") and untracked files in the way.
export const isBlockedByLocalChanges = (gitMessage: string) =>
  gitMessage.includes("would be overwritten by")
