import type { SessionLocationLabel } from "@ivin/plugin-api/ui"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { Worktree } from "@ivin/contracts/worktree"
import { folderName } from "./session-location.ts"

// A project folder's path, or `all` for every project folder together.
export type WorkspaceProject = "all" | (string & {})

type Place = Pick<Session, "projectPath" | "workingFolder" | "inWorktree">

// The project folder whose checkout, or one of whose `.worktrees/`, the session is in.
export const sessionProjectFolder = (session: Place, folders: readonly string[]) =>
  session.inWorktree
    ? (folders.find((folder) => session.workingFolder.startsWith(`${folder}/`)) ?? null)
    : folders.includes(session.workingFolder)
      ? session.workingFolder
      : null

// Where the session stands, or will once its first message is sent.
export const workspaceProject = (
  session: Place & Pick<Session, "started">,
  choice: WorkingFolderChoice,
  folders: readonly string[],
): WorkspaceProject => {
  if (!session.started && choice.kind === "new_worktree") return choice.folder ?? "all"
  return sessionProjectFolder(session, folders) ?? "all"
}

// "api ivin/77c0e2d4 · web fix/cart-badge" when the worktrees' branches differ.
export const workingFolderBranch = (worktree: Worktree) =>
  worktree.branch ??
  (worktree.repositories ?? []).map((r) => `${r.name} ${r.branch ?? "detached"}`).join(" · ")

export const workspaceLocation = (
  session: Place & Pick<Session, "started" | "branch">,
  choice: WorkingFolderChoice,
  folders: readonly string[],
  workingFolders: readonly Worktree[],
): SessionLocationLabel => {
  const project = workspaceProject(session, choice, folders)
  const name = project === "all" ? "All projects" : folderName(project)
  const pending =
    !session.started &&
    (choice.kind === "new_worktree" || (!session.inWorktree && project === "all"))
  if (pending) return { kind: "worktree", label: `${name} / New worktree`, branch: null }
  if (!session.inWorktree) {
    return session.branch === null
      ? { kind: "folder", label: name, branch: null }
      : { kind: "checkout", label: `${name} / Current checkout`, branch: session.branch }
  }
  const shared = workingFolders.find((w) => w.path === session.workingFolder)
  return {
    kind: "worktree",
    label: `${name} / Worktree`,
    branch: session.branch ?? (shared ? workingFolderBranch(shared) : null),
  }
}
