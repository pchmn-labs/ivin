import type { Session } from "@ivin/contracts/session"
import type { Branch } from "@ivin/contracts/worktree"
import { folderName } from "./session-location.ts"

type Place = Pick<Session, "projectPath" | "workingFolder">

const ORIGIN = "origin/"

// A remote branch is never checked out itself, so it carries no mark.
export const branchMark = (branch: Branch, place: Place) => {
  if (branch.remote || branch.worktreePath === null) return null
  if (branch.worktreePath === place.workingFolder) return "current" as const
  return branch.worktreePath === place.projectPath ? ("checkout" as const) : ("worktree" as const)
}

const folderLabel = (path: string, place: Place) =>
  path === place.projectPath ? "the checkout" : `the worktree .worktrees/${folderName(path)}`

// Mirrors how the server resolves a pick: a remote branch with a local branch of its name picks it.
export const pickPreview = (branch: Branch, branches: readonly Branch[], place: Place) => {
  const name = branch.remote ? branch.name.slice(ORIGIN.length) : branch.name
  const local = branches.find((b) => !b.remote && b.name === name)
  const here = folderLabel(place.workingFolder, place)
  if (!local) return `Creates ${name} from ${branch.name} and tracks it, in ${here}.`
  if (local.worktreePath === null) return `Checks out ${name} in ${here}.`
  if (local.worktreePath === place.workingFolder) return `Already on ${name}.`
  return `Moves this session to ${folderLabel(local.worktreePath, place)}.`
}
