import type { Keybinding } from "@ivin/contracts/keybinding"
import { Effect, Stream } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { resolveKeybindings, unreadableKeys } from "../rules/resolve-keybindings.ts"

export interface DefaultKeybinding extends Keybinding {
  readonly pluginId: string | null
}

export const coreKeybindings: ReadonlyArray<DefaultKeybinding> = [
  { key: "mod+\\", command: "sidebar.toggle", when: null, pluginId: null },
  { key: "mod+1", command: "sidebar.showSessions", when: null, pluginId: null },
  { key: "escape", command: "session.interrupt", when: null, pluginId: null },
  { key: "enter", command: "composer.send", when: "composer", pluginId: null },
  { key: "mod+shift+backspace", command: "session.archive", when: null, pluginId: null },
  { key: "mod+shift+a", command: "session.showArchived", when: null, pluginId: null },
  { key: "mod+backspace", command: "session.delete", when: "archivedSessions", pluginId: null },
  // Not mod+w: Electron's default menu closes the window on it.
  { key: "mod+shift+w", command: "tab.closeFile", when: null, pluginId: null },
  { key: "mod+s", command: "file.save", when: null, pluginId: null },
  { key: "mod+shift+enter", command: "tab.toggleFullWidth", when: null, pluginId: null },
  { key: "mod+alt+arrowright", command: "tab.nextCardTab", when: null, pluginId: null },
  { key: "mod+alt+arrowleft", command: "tab.previousCardTab", when: null, pluginId: null },
  { key: "mod+shift+m", command: "composer.chooseModel", when: "composer", pluginId: null },
  { key: "mod+shift+e", command: "composer.chooseEffort", when: "composer", pluginId: null },
  {
    key: "mod+shift+p",
    command: "composer.choosePermissionMode",
    when: "composer",
    pluginId: null,
  },
  { key: "mod+,", command: "settings.open", when: null, pluginId: null },
  { key: "escape", command: "settings.close", when: "settings", pluginId: null },
  ...(
    [
      ["arrowup", "tree.focusPrevious"],
      ["arrowdown", "tree.focusNext"],
      ["arrowleft", "tree.collapseOrParent"],
      ["arrowright", "tree.expandOrEnter"],
      ["home", "tree.focusFirst"],
      ["end", "tree.focusLast"],
      ["pageup", "tree.focusPageUp"],
      ["pagedown", "tree.focusPageDown"],
      ["shift+arrowup", "tree.selectPrevious"],
      ["shift+arrowdown", "tree.selectNext"],
      ["enter", "tree.open"],
      ["space", "tree.open"],
    ] as const
  ).map(([key, command]) => ({ key, command, when: "tree", pluginId: null })),
]

export const defaultKeybindingsAtom = Atom.make<ReadonlyArray<DefaultKeybinding>>(
  coreKeybindings,
).pipe(Atom.keepAlive)

export const userKeybindingsAtom = serverRuntime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["keybinding.watch"]()
      }),
    ),
  )
  .pipe(Atom.keepAlive)

const userKeybindingsValueAtom = Atom.readable((get) => {
  const result = get(userKeybindingsAtom)
  return AsyncResult.isSuccess(result) ? result.value : { keybindings: [], problem: null }
})

export const keybindingsFileProblemAtom = Atom.readable(
  (get) => get(userKeybindingsValueAtom).problem,
)

export const unreadableKeysAtom = Atom.readable((get) =>
  unreadableKeys(get(userKeybindingsValueAtom).keybindings),
)

export const keybindingsOf = Atom.family((mac: boolean) =>
  Atom.readable((get) => {
    const { keybindings, conflicts } = resolveKeybindings({
      defaults: get(defaultKeybindingsAtom),
      user: get(userKeybindingsValueAtom).keybindings,
      platform: { mac },
    })
    for (const conflict of conflicts) console.warn("keybinding replaces a default one", conflict)
    return keybindings
  }),
)
