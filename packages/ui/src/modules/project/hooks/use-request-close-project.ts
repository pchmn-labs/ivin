import { RegistryContext, useAtomSet } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { useCallback, useContext } from "react"
import { unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { sessionConfirmationAtom } from "../../session/atoms/session-confirmation.ts"
import { needsConfirmation } from "../../session/rules/session-confirmation.ts"
import { closeProjectAtom } from "../atoms/close-project.ts"

export function useRequestCloseProject() {
  const close = useAtomSet(closeProjectAtom)
  const confirm = useAtomSet(sessionConfirmationAtom)
  const registry = useContext(RegistryContext)
  return useCallback(
    (project: Project) => {
      const sessions = registry.get(sessionsOf(project.path).items)
      const confirmation = {
        action: "closeProject" as const,
        project,
        sessions: sessions.map((session) => ({
          title: session.title,
          unsaved: registry.get(unsavedPathsOf(session.id, session.workingFolder)),
        })),
      }
      if (needsConfirmation(confirmation)) confirm(confirmation)
      else close(project.path)
    },
    [registry, confirm, close],
  )
}
