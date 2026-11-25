import { useAtomSet } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { createSessionAtom } from "../atoms/create-session.ts"
import { startSessionFailureAtom } from "../atoms/start-session-failure.ts"
import { createSessionFailure } from "../rules/failure-message.ts"

export function useStartSession() {
  const createSession = useAtomSet(createSessionAtom, { mode: "promiseExit" })
  const openTab = useAtomSet(openTabAtom)
  const setFailure = useAtomSet(startSessionFailureAtom)
  return async (projectPath: string, after?: string) => {
    setFailure(null)
    const exit = await createSession({ projectPath })
    if (Exit.isSuccess(exit)) openTab({ sessionId: exit.value.id, after })
    else if (!Cause.hasInterruptsOnly(exit.cause)) {
      setFailure({ projectPath, failure: createSessionFailure(Cause.squash(exit.cause)) })
    }
  }
}
