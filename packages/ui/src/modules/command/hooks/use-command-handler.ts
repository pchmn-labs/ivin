import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect, useRef } from "react"
import { addCommandHandler } from "../atoms/run-command.ts"

export function useCommandHandler(commandId: string, run: () => void, enabled = true) {
  const registry = useContext(RegistryContext)
  const latest = useRef(run)
  useEffect(() => {
    latest.current = run
  })
  useEffect(() => {
    if (!enabled) return
    return addCommandHandler(registry, commandId, () => latest.current(), null)
  }, [registry, commandId, enabled])
}
