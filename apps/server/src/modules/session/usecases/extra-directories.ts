import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { sessionProjectFolder } from "./session-project-folder.ts"

// Workspace folders outside the working folder: on one project folder's checkout or worktree the
// others, on a working folder of several repositories the non-repositories.
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
    const own = yield* sessionProjectFolder(session)
    if (own !== null) return folders.filter((folder) => folder !== own)
    const git = yield* Git
    const outside: string[] = []
    for (const folder of folders) if ((yield* git.gitDir(folder)) === null) outside.push(folder)
    return outside
  })
