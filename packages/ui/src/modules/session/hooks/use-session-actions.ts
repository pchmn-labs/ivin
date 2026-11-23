import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { MenuItem } from "@ivin/plugin-api/ui"
import { useCallback, useContext } from "react"
import { unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { archiveSessionAtom } from "../atoms/archive-session.ts"
import { sessionActionFailureOf } from "../atoms/session-action-failure.ts"
import { sessionConfirmationAtom } from "../atoms/session-confirmation.ts"
import type { ConfirmedAction } from "../rules/session-action-failure.ts"
import { needsConfirmation } from "../rules/session-confirmation.ts"

export function useRequestSessionAction() {
  const confirm = useAtomSet(sessionConfirmationAtom)
  const archive = useAtomSet(archiveSessionAtom, { mode: "promiseExit" })
  const registry = useContext(RegistryContext)
  return useCallback(
    async (action: ConfirmedAction, session: Session): Promise<void> => {
      const unsaved = registry.get(unsavedPathsOf(session.id, session.workingFolder))
      const confirmation = { action, session, unsaved }
      if (needsConfirmation(confirmation)) confirm(confirmation)
      else await archive({ projectPath: session.projectPath, sessionId: session.id })
    },
    [registry, confirm, archive],
  )
}

// No items while the session is not loaded.
export function useSessionActions(session: Session | undefined): {
  readonly items: ReadonlyArray<MenuItem>
  readonly failure: string | null
} {
  const request = useRequestSessionAction()
  const failure = useAtomValue(sessionActionFailureOf(session?.id ?? ""))
  if (session === undefined) return { items: [], failure: null }
  return {
    items: [
      { label: "Archive", icon: "archive", onSelect: () => request("archive", session) },
      { label: "Delete…", icon: "trash", danger: true, onSelect: () => request("delete", session) },
    ],
    failure,
  }
}
