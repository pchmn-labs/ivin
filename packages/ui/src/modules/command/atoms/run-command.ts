import type { AtomRegistry } from "effect/reactivity"
import { notify } from "../../../core/components/notification/notification-manager.ts"
import { CommandFailure } from "../rules/command-failure.ts"
import { commandHandlersAtom, commandsAtom } from "./commands.ts"

// False when no handler runs the command, so the key can keep its default action.
export const runCommand = (registry: AtomRegistry.AtomRegistry, commandId: string): boolean => {
  // The last handler registered wins: a component mounted later takes over the command.
  const handler = registry.get(commandHandlersAtom).findLast((h) => h.commandId === commandId)
  if (handler === undefined) return false
  const failed = (error: unknown) => {
    if (error instanceof CommandFailure) {
      notify({
        message: error.message,
        ...(error.retry && { action: { label: "Retry", onClick: error.retry } }),
      })
      return
    }
    const title = registry.get(commandsAtom).find((c) => c.id === commandId)?.title ?? commandId
    notify({ message: `${title} failed.` })
    throw error
  }
  try {
    void Promise.resolve(handler.run()).catch(failed)
  } catch (error) {
    failed(error)
  }
  return true
}

export const addCommandHandler = (
  registry: AtomRegistry.AtomRegistry,
  commandId: string,
  run: () => unknown,
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
