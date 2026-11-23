import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { MenuItem } from "@ivin/plugin-api/ui"
import { useCallback, useContext, useEffect } from "react"
import { unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { notifyCommandFailure } from "../../command/atoms/run-command.ts"
import { CommandFailure } from "../../command/rules/command-failure.ts"
import { archiveSessionAtom } from "../atoms/archive-session.ts"
import {
  sessionActionFailureOf,
  sessionActionFailureShownBy,
} from "../atoms/session-action-failure.ts"
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

// The handler of `session.archive`: its failure shows in a menu that is closed when the key is pressed.
export function useArchiveFromKey(session: Session | undefined) {
  const registry = useContext(RegistryContext)
  const request = useRequestSessionAction()
  return useCallback(async (): Promise<void> => {
    if (session === undefined) return
    const failureOf = sessionActionFailureOf(session.id)
    const attempt = async (): Promise<void> => {
      registry.set(failureOf, null)
      await request("archive", session)
      const failure = registry.get(failureOf)
      if (failure === null || registry.get(sessionActionFailureShownBy(session.id)) > 0) return
      const retry = () =>
        void attempt().catch((error: unknown) => {
          if (error instanceof CommandFailure) notifyCommandFailure(error)
          else throw error
        })
      throw new CommandFailure(failure, retry)
    }
    await attempt()
  }, [registry, request, session])
}

// No items while the session is not loaded.
// `showsFailure` is false for a caller that does not draw the failure.
export function useSessionActions(
  session: Session | undefined,
  showsFailure = true,
): {
  readonly items: ReadonlyArray<MenuItem>
  readonly failure: string | null
} {
  const registry = useContext(RegistryContext)
  const request = useRequestSessionAction()
  const failure = useAtomValue(sessionActionFailureOf(session?.id ?? ""))
  const sessionId = session?.id
  useEffect(() => {
    if (sessionId === undefined || !showsFailure) return
    const shownBy = sessionActionFailureShownBy(sessionId)
    registry.set(shownBy, registry.get(shownBy) + 1)
    return () => registry.set(shownBy, registry.get(shownBy) - 1)
  }, [registry, sessionId, showsFailure])
  if (session === undefined) return { items: [], failure: null }
  return {
    items: [
      { label: "Archive", icon: "archive", onSelect: () => request("archive", session) },
      { label: "Delete…", icon: "trash", danger: true, onSelect: () => request("delete", session) },
    ],
    failure,
  }
}
