import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useEffect } from "react"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { selectedSessionIdAtom } from "../../tab/atoms/selected-session-id.ts"
import { sessionHistoryAtom } from "../atoms/session-history.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import {
  canGoBack,
  canGoForward,
  currentOf,
  goBack,
  goForward,
  visit,
} from "../rules/session-history.ts"

export function useRecordSessionVisits() {
  const selectedId = useAtomValue(selectedSessionIdAtom)
  const setHistory = useAtomSet(sessionHistoryAtom)

  // Keyed on the selection alone: a step back changes the history before the server selects that session.
  useEffect(() => {
    if (selectedId !== null) setHistory((history) => visit(history, selectedId))
  }, [selectedId, setHistory])
}

export function useSessionHistory(projectPath: string) {
  const openTab = useAtomSet(openTabAtom)
  const [history, setHistory] = useAtom(sessionHistoryAtom)
  const ids = useAtomValue(sessionsOf(projectPath).ids)
  const exists = (id: string) => ids.includes(id)

  const move = (next: typeof history) => {
    setHistory(next)
    const sessionId = currentOf(next)
    if (sessionId !== null) openTab({ sessionId })
  }

  return {
    canGoBack: canGoBack(history, exists),
    canGoForward: canGoForward(history, exists),
    goBack: () => move(goBack(history, exists)),
    goForward: () => move(goForward(history, exists)),
  }
}
