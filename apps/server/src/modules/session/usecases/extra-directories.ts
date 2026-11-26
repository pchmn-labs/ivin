import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { Git } from "../../worktree/usecases/git.ts"

// Workspace folders outside the working folder: on the checkouts those not under it, else the non-repositories.
export const extraDirectoriesOf = (session: Session) =>
  Effect.gen(function* () {
    if (!isWorkspaceFile(session.projectPath)) return []
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    if (!session.inWorktree) {
      return folders.filter(
        (folder) =>
          folder !== session.workingFolder && !folder.startsWith(`${session.workingFolder}/`),
      )
    }
    const git = yield* Git
    const outside: string[] = []
    for (const folder of folders) if ((yield* git.gitDir(folder)) === null) outside.push(folder)
    return outside
  })
