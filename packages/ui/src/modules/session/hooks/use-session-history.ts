import { useAtom } from "@effect/atom-react"
import { useEffect } from "react"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { sessionHistoryAtom } from "../atoms/session-history.ts"
import {
  canGoBack,
  canGoForward,
  currentOf,
  goBack,
  goForward,
  visit,
} from "../rules/session-history.ts"

export function useSessionHistory() {
  const [selectedId, select] = useAtom(selectedSessionIdAtom)
  const [history, setHistory] = useAtom(sessionHistoryAtom)

  useEffect(() => {
    if (selectedId !== null) setHistory(visit(history, selectedId))
  }, [selectedId, history, setHistory])

  const move = (next: typeof history) => {
    setHistory(next)
    select(currentOf(next))
  }

  return {
    canGoBack: canGoBack(history),
    canGoForward: canGoForward(history),
    goBack: () => move(goBack(history)),
    goForward: () => move(goForward(history)),
  }
}
