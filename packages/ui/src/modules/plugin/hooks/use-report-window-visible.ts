import { useAtomSet } from "@effect/atom-react"
import { useEffect } from "react"
import { setWindowVisibleAtom } from "../atoms/set-window-visible.ts"

// Plugins' polling pauses while the window is hidden.
export const useReportWindowVisible = () => {
  const report = useAtomSet(setWindowVisibleAtom)
  useEffect(() => {
    const send = () => report(document.visibilityState === "visible")
    send()
    document.addEventListener("visibilitychange", send)
    return () => document.removeEventListener("visibilitychange", send)
  }, [report])
}
