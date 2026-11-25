import type { ToolActivity } from "@ivin/harness"

// A shell command can create a worktree, through git or a script that wraps it.
export const needsWorktreeList = (activity: ToolActivity) => activity.type !== "other"

const PATH_CHAR = /[\w.\-~]/
const CREATION = /git\s+(?:-C\s+\S+\s+)?worktree\s+add\b[^;&|\n]*/g

const pathForms = (folder: string, from: string) => {
  if (!folder.startsWith(`${from}/`)) return [folder]
  const relative = folder.slice(from.length + 1)
  return [folder, relative, `./${relative}`]
}

// Subfolders count as a mention: `cd <folder>/src` runs in `<folder>`.
const mentionsAt = (text: string, spelling: string) => {
  const starts: number[] = []
  for (let at = text.indexOf(spelling); at !== -1; at = text.indexOf(spelling, at + 1)) {
    const before = text[at - 1]
    const after = text[at + spelling.length]
    const startsPath = before === undefined || !(PATH_CHAR.test(before) || before === "/")
    const endsPath = after === undefined || !PATH_CHAR.test(after)
    if (startsPath && endsPath) starts.push(at)
  }
  return starts
}

// The folder mentioned last; at one position, the longest, so a worktree inside the checkout wins.
const lastMentioned = (text: string, folders: readonly string[], from: string) => {
  let best: { folder: string; at: number; length: number } | null = null
  for (const folder of folders) {
    for (const spelling of pathForms(folder, from)) {
      for (const at of mentionsAt(text, spelling)) {
        if (!best || at > best.at || (at === best.at && spelling.length > best.length)) {
          best = { folder, at, length: spelling.length }
        }
      }
    }
  }
  return best?.folder ?? null
}

// `git worktree move` of the working folder, read from the worktree list rather than the command.
export const folderMovedTo = ({
  workingFolder,
  projectPath,
  listed,
  appeared,
}: {
  readonly workingFolder: string
  readonly projectPath: string
  readonly listed: ReadonlySet<string>
  readonly appeared: readonly string[]
}): string | null =>
  workingFolder !== projectPath && !listed.has(workingFolder) && appeared.length === 1
    ? appeared[0]!
    : null

// Where the agent works after this tool call, or null when it stays.
// `folders`: the checkout and the worktrees git lists; `adoptable`: the worktrees the agent may be working in.
export const folderAfterTool = ({
  activity,
  workingFolder,
  folders,
  adoptable,
}: {
  readonly activity: ToolActivity
  readonly workingFolder: string
  readonly folders: readonly string[]
  readonly adoptable: readonly string[]
}): string | null => {
  const target =
    activity.type === "folder_switch"
      ? folders.includes(activity.path)
        ? activity.path
        : null
      : lastMentioned(
          activity.type === "shell" ? activity.command.replace(CREATION, "") : activity.text,
          adoptable,
          workingFolder,
        )
  return target === workingFolder ? null : target
}
