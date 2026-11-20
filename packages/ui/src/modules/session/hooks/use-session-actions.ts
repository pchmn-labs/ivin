import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { MenuItem } from "@ivin/plugin-api/ui"
import { useCallback } from "react"
import { archiveSessionAtom } from "../atoms/archive-session.ts"
import { sessionActionFailureOf } from "../atoms/session-action-failure.ts"
import { sessionConfirmationAtom } from "../atoms/session-confirmation.ts"
import { isRunning } from "../rules/is-running.ts"

export function useRequestSessionAction() {
  const confirm = useAtomSet(sessionConfirmationAtom)
  const archive = useAtomSet(archiveSessionAtom)
  return useCallback(
    (action: "archive" | "delete", session: Session) => {
      if (action === "delete" || isRunning(session.status)) confirm({ action, session })
      else archive({ projectPath: session.projectPath, sessionId: session.id })
    },
    [confirm, archive],
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
