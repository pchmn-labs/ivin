import { Atom } from "effect/reactivity"

export interface Command {
  readonly id: string
  readonly title: string
  readonly pluginId: string | null
}

export interface CommandHandler {
  readonly commandId: string
  readonly run: () => void
  readonly pluginId: string | null
}

export const coreCommands: ReadonlyArray<Command> = [
  { id: "sidebar.toggle", title: "Toggle sidebar", pluginId: null },
  { id: "sidebar.showSessions", title: "Show sessions", pluginId: null },
  { id: "session.interrupt", title: "Interrupt", pluginId: null },
  { id: "composer.send", title: "Send", pluginId: null },
  { id: "session.archive", title: "Archive session", pluginId: null },
  { id: "session.showArchived", title: "Show archived sessions", pluginId: null },
  { id: "session.delete", title: "Delete session", pluginId: null },
  { id: "tab.closeFile", title: "Close file", pluginId: null },
  { id: "tab.toggleFullWidth", title: "Toggle full width", pluginId: null },
  { id: "tab.nextCardTab", title: "Next tab of the files card", pluginId: null },
  { id: "tab.previousCardTab", title: "Previous tab of the files card", pluginId: null },
  { id: "composer.chooseModel", title: "Choose the model", pluginId: null },
  { id: "composer.chooseEffort", title: "Choose the effort", pluginId: null },
  { id: "composer.choosePermissionMode", title: "Choose the permission mode", pluginId: null },
]

export const commandsAtom = Atom.make<ReadonlyArray<Command>>(coreCommands).pipe(Atom.keepAlive)

export const commandHandlersAtom = Atom.make<ReadonlyArray<CommandHandler>>([]).pipe(Atom.keepAlive)
