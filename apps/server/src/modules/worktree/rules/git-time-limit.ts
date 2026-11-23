import { commandOf } from "./git-overrides.ts"

const LONG = new Set([
  // These write the working tree through smudge filters, such as Git LFS's, which can take minutes.
  "checkout",
  "worktree add",
  "stash",
  "commit",
  "merge",
  "restore",
  // OriginFetch stops it sooner, with an error of its own.
  "fetch",
])

export type GitTimeLimit = "short" | "long"

export const timeLimitOf = (args: ReadonlyArray<string>): GitTimeLimit =>
  LONG.has(commandOf(args)) ? "long" : "short"
