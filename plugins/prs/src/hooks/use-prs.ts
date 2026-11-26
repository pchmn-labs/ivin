import { useMemo } from "react"
import { useAnnotations } from "@ivin/plugin-api/ui"
import { groupPrs } from "../rules/prs.ts"

export const usePrs = (sessionId: string) => {
  const annotations = useAnnotations(sessionId, "pr")
  return useMemo(
    () => groupPrs(annotations.map((annotation) => ({ id: annotation.id, data: annotation.data }))),
    [annotations],
  )
}
