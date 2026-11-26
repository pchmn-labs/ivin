import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { ProjectTrust } from "../../project/usecases/project-trust.ts"

// A session on a workspace's checkouts runs in a folder that is none of the project folders, so
// each of those must be trusted instead.
export const sessionFolderTrusted = (session: Session) =>
  Effect.gen(function* () {
    const trust = yield* ProjectTrust
    if (!isWorkspaceFile(session.projectPath) || session.inWorktree) {
      return yield* trust.isTrusted(session.workingFolder)
    }
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    for (const folder of folders) if (!(yield* trust.isTrusted(folder))) return false
    return folders.length > 0
  })
