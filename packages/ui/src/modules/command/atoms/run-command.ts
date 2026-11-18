import type { AtomRegistry } from "effect/reactivity"
import { commandHandlersAtom } from "./commands.ts"

// False when no handler runs the command, so the key can keep its default action.
export const runCommand = (registry: AtomRegistry.AtomRegistry, commandId: string): boolean => {
  // The last handler registered wins: a component mounted later takes over the command.
  const handler = registry.get(commandHandlersAtom).findLast((h) => h.commandId === commandId)
  if (handler === undefined) return false
  handler.run()
  return true
}

export const addCommandHandler = (
  registry: AtomRegistry.AtomRegistry,
  commandId: string,
  run: () => void,
  pluginId: string | null,
): (() => void) => {
  const handler = { commandId, run, pluginId }
  registry.set(commandHandlersAtom, [...registry.get(commandHandlersAtom), handler])
  return () =>
    registry.set(
      commandHandlersAtom,
      registry.get(commandHandlersAtom).filter((h) => h !== handler),
    )
}
