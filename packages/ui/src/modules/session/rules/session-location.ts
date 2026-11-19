import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { Worktree } from "@ivin/contracts/worktree"

export interface Location {
  readonly kind: "checkout" | "worktree" | "folder"
  readonly label: string
  // Null when there is none yet, or outside a git repository.
  readonly branch: string | null
}

const folderName = (path: string) => path.split("/").filter(Boolean).at(-1) ?? path

// Before the first message, the location is the one the user chose.
export const sessionLocation = (
  session: Pick<Session, "started" | "inWorktree" | "branch" | "workingFolder">,
  choice: WorkingFolderChoice,
  worktrees: ReadonlyArray<Worktree>,
): Location => {
  if (!session.started && choice.kind === "new_worktree") {
    return { kind: "worktree", label: "New worktree", branch: null }
  }
  if (!session.started && choice.kind === "existing_worktree") {
    const worktree = worktrees.find((w) => w.path === choice.path)
    return {
      kind: "worktree",
      label: "Worktree",
      branch: worktree?.branch ?? folderName(choice.path),
    }
  }
  if (session.inWorktree) return { kind: "worktree", label: "Worktree", branch: session.branch }
  if (session.branch === null) return { kind: "folder", label: session.workingFolder, branch: null }
  return { kind: "checkout", label: "Current checkout", branch: session.branch }
}
