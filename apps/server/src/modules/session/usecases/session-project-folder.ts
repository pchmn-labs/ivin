import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { listCheckoutWorktreesOrNone } from "../../worktree/usecases/list-worktrees.ts"

// The project folder of a workspace whose checkout or one of whose worktrees the session is in;
// null on a working folder of several repositories, and outside a workspace.
export const sessionProjectFolder = (
  session: Pick<Session, "projectPath" | "workingFolder" | "inWorktree">,
) =>
  Effect.gen(function* () {
    if (!isWorkspaceFile(session.projectPath)) return null
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    if (!session.inWorktree)
      return folders.includes(session.workingFolder) ? session.workingFolder : null
    const git = yield* Git
    for (const folder of folders) {
      if ((yield* git.gitDir(folder)) === null) continue
      const worktrees = yield* listCheckoutWorktreesOrNone(folder)
      if (worktrees.some((w) => w.path === session.workingFolder)) return folder
    }
    return null
  })
