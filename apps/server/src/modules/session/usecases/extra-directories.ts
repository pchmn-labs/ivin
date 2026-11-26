import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { checkoutStart } from "../../worktree/rules/workspace-folder.ts"
import { Git } from "../../worktree/usecases/git.ts"

// What the agent may use besides its working folder: of a workspace, the folders that are not in
// the working folder (the others than the first when on the checkouts, the non-repositories in a
// working folder of worktrees), at their real paths.
export const extraDirectoriesOf = (session: Session) =>
  Effect.gen(function* () {
    if (!isWorkspaceFile(session.projectPath)) return []
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    if (!session.inWorktree) return checkoutStart(folders)?.extraDirectories ?? []
    const git = yield* Git
    const outside: string[] = []
    for (const folder of folders) if ((yield* git.gitDir(folder)) === null) outside.push(folder)
    return outside
  })
