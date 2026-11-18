import type { AtomRegistry } from "effect/reactivity"
import { commandHandlersAtom } from "./commands.ts"

// False when no handler runs the command, so the key can keep its default action.
export const runCommand = (registry: AtomRegistry.AtomRegistry, commandId: string): boolean => {
  const handler = registry.get(commandHandlersAtom).findLast((h) => h.commandId === commandId)
  if (handler === undefined) return false
  handler.run()
  return true
}

export const addCommandHandler = (
  registry: AtomRegistry.AtomRegistry,
  commandId: string,
  run: () => void,
  owner: string | symbol,
): (() => void) => {
  const handler = { commandId, run, owner }
  registry.set(commandHandlersAtom, [...registry.get(commandHandlersAtom), handler])
  return () =>
    registry.set(
      commandHandlersAtom,
      registry.get(commandHandlersAtom).filter((h) => h !== handler),
    )
}
