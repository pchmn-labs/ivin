import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect, useRef } from "react"
import { addCommandHandler } from "../atoms/run-command.ts"

export function useCommandHandler(commandId: string, run: () => void, enabled = true) {
  useCommandHandlers({ [commandId]: run }, enabled)
}

// The set of command ids must not change between renders.
export function useCommandHandlers(handlers: Readonly<Record<string, () => void>>, enabled = true) {
  const registry = useContext(RegistryContext)
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })
  const ids = Object.keys(handlers).join("\n")
  useEffect(() => {
    if (!enabled) return
    const removes = ids
      .split("\n")
      .map((id) => addCommandHandler(registry, id, () => latest.current[id]?.(), null))
    return () => removes.forEach((remove) => remove())
  }, [registry, ids, enabled])
}
