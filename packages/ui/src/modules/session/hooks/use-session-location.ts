import { useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import { worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { sessionLocation } from "../rules/session-location.ts"

export const useSessionLocation = (session: Session) => {
  const choice = useAtomValue(workingFolderChoiceOf(session.id))
  const worktrees = useAtomValue(worktreesOf(session.projectPath))
  return sessionLocation(
    session,
    choice,
    AsyncResult.getOrElse(worktrees, () => []),
  )
}
