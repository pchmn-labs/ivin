import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect, useRef } from "react"
import { dialogViewOf, sheetViewsOf } from "../atoms/overlay-views.ts"
import { noSheetViews } from "../rules/overlay-views.ts"

// Sheet and dialog views are never stored, so a move to another working folder closes them here.
export function useCloseViewsOnMove(sessionId: string, workingFolder: string | undefined) {
  const registry = useContext(RegistryContext)
  const previous = useRef(workingFolder)
  useEffect(() => {
    const before = previous.current
    previous.current = workingFolder
    if (before === undefined || before === workingFolder) return
    registry.set(sheetViewsOf(sessionId, before), noSheetViews)
    registry.set(dialogViewOf(sessionId, before), null)
  }, [registry, sessionId, workingFolder])
}
