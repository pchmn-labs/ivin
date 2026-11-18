import { useAtomSet } from "@effect/atom-react"
import { Exit } from "effect"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { createSessionAtom } from "../atoms/create-session.ts"

export function useStartSession() {
  const createSession = useAtomSet(createSessionAtom, { mode: "promiseExit" })
  const openTab = useAtomSet(openTabAtom)
  return async (projectPath: string, model: string) => {
    const exit = await createSession({ projectPath, model })
    if (Exit.isSuccess(exit)) openTab({ sessionId: exit.value.id })
  }
}
