const READS = new Set([
  "status",
  "diff",
  "log",
  "rev-parse",
  "rev-list",
  "ls-files",
  "merge-base",
  "merge-tree",
  "patch-id",
  "for-each-ref",
  "symbolic-ref",
  "remote",
  "check-ignore",
  "worktree list",
])

export const commandOf = (args: ReadonlyArray<string>) => {
  const at = args.findIndex((arg) => !arg.startsWith("-"))
  if (at === -1) return ""
  return args[at] === "worktree" ? `worktree ${args[at + 1] ?? ""}` : (args[at] ?? "")
}

export const withOverrides = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const name = commandOf(args)
  return [
    "-c",
    "core.fsmonitor=false",
    ...(READS.has(name) ? ["-c", "core.hooksPath=/dev/null"] : []),
    ...(name === "fetch" ? ["-c", "protocol.ext.allow=never"] : []),
    ...args,
  ]
}
