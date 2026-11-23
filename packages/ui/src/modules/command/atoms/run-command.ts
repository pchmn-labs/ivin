import type { AtomRegistry } from "effect/reactivity"
import { notify } from "../../../core/components/notification/notification-manager.ts"
import { CommandFailure } from "../rules/command-failure.ts"
import { commandHandlersAtom, commandsAtom } from "./commands.ts"

export const notifyCommandFailure = ({ message, retry }: CommandFailure): void =>
  notify({ message, ...(retry && { action: { label: "Retry", onClick: retry } }) })

// False when no handler runs the command, so the key can keep its default action.
export const runCommand = (registry: AtomRegistry.AtomRegistry, commandId: string): boolean => {
  // The last handler registered wins: a component mounted later takes over the command.
  const handler = registry.get(commandHandlersAtom).findLast((h) => h.commandId === commandId)
  if (handler === undefined) return false
  const run = (): Promise<unknown> => {
    try {
      return Promise.resolve(handler.run())
    } catch (error) {
      return Promise.reject(error)
    }
  }
  void run().catch((error: unknown) => {
    if (error instanceof CommandFailure) return notifyCommandFailure(error)
    const title = registry.get(commandsAtom).find((c) => c.id === commandId)?.title ?? commandId
    notify({ message: `${title} failed.` })
    // Left unhandled, so the window's error reporter writes it to the log.
    throw error
  })
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
