import { Atom } from "effect/reactivity"

export interface Command {
  readonly id: string
  readonly title: string
  readonly pluginId: string | null
}

export interface CommandHandler {
  readonly commandId: string
  readonly run: () => unknown
  readonly pluginId: string | null
}

export const coreCommands: ReadonlyArray<Command> = [
  { id: "sidebar.toggle", title: "Toggle sidebar", pluginId: null },
  { id: "sidebar.showSessions", title: "Show sessions", pluginId: null },
  { id: "project.next", title: "Next project", pluginId: null },
  { id: "project.previous", title: "Previous project", pluginId: null },
  { id: "session.interrupt", title: "Interrupt", pluginId: null },
  { id: "composer.send", title: "Send", pluginId: null },
  { id: "session.sendNow", title: "Send now", pluginId: null },
  { id: "session.archive", title: "Archive session", pluginId: null },
  { id: "session.showArchived", title: "Show archived sessions", pluginId: null },
  { id: "session.delete", title: "Delete session", pluginId: null },
  { id: "tab.closeFile", title: "Close file", pluginId: null },
  { id: "file.save", title: "Save file", pluginId: null },
  { id: "tab.toggleFullWidth", title: "Toggle full width", pluginId: null },
  { id: "tab.nextCardTab", title: "Next tab of the files card", pluginId: null },
  { id: "tab.previousCardTab", title: "Previous tab of the files card", pluginId: null },
  { id: "composer.chooseModel", title: "Choose the model", pluginId: null },
  { id: "composer.chooseEffort", title: "Choose the effort", pluginId: null },
  { id: "composer.choosePermissionMode", title: "Choose the permission mode", pluginId: null },
  { id: "settings.open", title: "Open settings", pluginId: null },
  { id: "settings.close", title: "Close settings", pluginId: null },
  { id: "cli.installInShell", title: "Install the ivin command in your shell", pluginId: null },
  { id: "tree.focusPrevious", title: "Move up in the tree", pluginId: null },
  { id: "tree.focusNext", title: "Move down in the tree", pluginId: null },
  { id: "tree.collapseOrParent", title: "Close the folder, or go to its parent", pluginId: null },
  { id: "tree.expandOrEnter", title: "Open the folder, or go into it", pluginId: null },
  { id: "tree.focusFirst", title: "Go to the first row of the tree", pluginId: null },
  { id: "tree.focusLast", title: "Go to the last row of the tree", pluginId: null },
  { id: "tree.focusPageUp", title: "Move a page up in the tree", pluginId: null },
  { id: "tree.focusPageDown", title: "Move a page down in the tree", pluginId: null },
  { id: "tree.selectPrevious", title: "Extend the selection up", pluginId: null },
  { id: "tree.selectNext", title: "Extend the selection down", pluginId: null },
  { id: "tree.open", title: "Open the file, or open or close the folder", pluginId: null },
]

export const commandsAtom = Atom.make<ReadonlyArray<Command>>(coreCommands).pipe(Atom.keepAlive)

export const commandHandlersAtom = Atom.make<ReadonlyArray<CommandHandler>>([]).pipe(Atom.keepAlive)
