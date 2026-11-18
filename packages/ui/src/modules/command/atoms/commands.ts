import { Atom } from "effect/reactivity"

export interface Command {
  readonly id: string
  readonly title: string
  // Null for a command of the core.
  readonly pluginId: string | null
}

// A command runs through the last handler registered for it; a command with none does nothing.
export interface CommandHandler {
  readonly commandId: string
  readonly run: () => void
  readonly owner: string | symbol
}

export const coreCommands: ReadonlyArray<Command> = [
  { id: "sidebar.toggle", title: "Toggle sidebar", pluginId: null },
  { id: "session.interrupt", title: "Interrupt", pluginId: null },
  { id: "composer.send", title: "Send", pluginId: null },
]

export const commandsAtom = Atom.make<ReadonlyArray<Command>>(coreCommands).pipe(Atom.keepAlive)

export const commandHandlersAtom = Atom.make<ReadonlyArray<CommandHandler>>([]).pipe(Atom.keepAlive)
