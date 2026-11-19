import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { Worktree } from "@ivin/contracts/worktree"

export interface WorkingFolderLabel {
  readonly kind: "checkout" | "worktree" | "folder"
  readonly label: string
  // Null when there is none yet, or outside a git repository.
  readonly branch: string | null
}

export const folderName = (path: string) => path.split("/").filter(Boolean).at(-1) ?? path

// `base` is what the server will start the worktree from; `HEAD` means the checkout's branch.
export const newBranchLabel = (base: string | null, checkoutBranch: string | null) => {
  const from = base === "HEAD" ? checkoutBranch : base
  return from === null ? "New branch" : `New branch from ${from}`
}

export const sessionLocation = (
  session: Pick<Session, "started" | "inWorktree" | "branch" | "workingFolder">,
  choice: WorkingFolderChoice,
  worktrees: ReadonlyArray<Worktree>,
): WorkingFolderLabel => {
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
