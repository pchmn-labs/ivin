import { useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import { useWorkspaceFolders } from "../../project/hooks/use-is-workspace.ts"
import { worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { sessionLocation } from "../rules/session-location.ts"
import { workspaceLocation } from "../rules/workspace-location.ts"

export const useSessionLocation = (session: Session) => {
  const choice = useAtomValue(workingFolderChoiceOf(session.id))
  const worktrees = AsyncResult.getOrElse(useAtomValue(worktreesOf(session.projectPath)), () => [])
  const folders = useWorkspaceFolders(session.projectPath)
  if (folders !== null && session.workingFolderDeleted !== true) {
    return workspaceLocation(session, choice, folders, worktrees)
  }
  return sessionLocation(session, choice, worktrees)
}
