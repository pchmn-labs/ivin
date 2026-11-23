import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect, useRef } from "react"
import { addCommandHandler } from "../atoms/run-command.ts"

export function useCommandHandler(commandId: string, run: () => unknown, enabled = true) {
  useCommandHandlers({ [commandId]: run }, enabled)
}

export function useCommandHandlers(
  handlers: Readonly<Record<string, () => unknown>>,
  enabled = true,
) {
  const registry = useContext(RegistryContext)
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })
  // A string, so the same ids from a new object keep the handlers registered.
  const ids = Object.keys(handlers).join("\n")
  useEffect(() => {
    if (!enabled) return
    const removes = ids
      .split("\n")
      .map((id) => addCommandHandler(registry, id, () => latest.current[id]?.(), null))
    return () => removes.forEach((remove) => remove())
  }, [registry, ids, enabled])
}
