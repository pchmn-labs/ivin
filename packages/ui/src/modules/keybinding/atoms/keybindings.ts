import type { Keybinding } from "@ivin/contracts/keybinding"
import { Effect, Stream } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { resolveKeybindings } from "../rules/resolve-keybindings.ts"

export interface DefaultKeybinding extends Keybinding {
  // Null for a keybinding of the core.
  readonly pluginId: string | null
}

export const coreKeybindings: ReadonlyArray<DefaultKeybinding> = [
  { key: "mod+\\", command: "sidebar.toggle", when: null, pluginId: null },
  { key: "escape", command: "session.interrupt", when: null, pluginId: null },
  { key: "enter", command: "composer.send", when: "composer", pluginId: null },
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

export const keybindingsFileProblemAtom = Atom.readable((get) => {
  const result = get(userKeybindingsAtom)
  return AsyncResult.isSuccess(result) ? result.value.problem : null
})

export const keybindingsOf = Atom.family((mac: boolean) =>
  Atom.readable((get) => {
    const result = get(userKeybindingsAtom)
    const { keybindings, conflicts, unreadable } = resolveKeybindings({
      defaults: get(defaultKeybindingsAtom),
      user: AsyncResult.isSuccess(result) ? result.value.keybindings : [],
      platform: { mac },
    })
    for (const conflict of conflicts) console.warn("keybinding replaces a default one", conflict)
    for (const key of unreadable) console.warn(`keybinding ignored, its key cannot be read: ${key}`)
    return keybindings
  }),
)
