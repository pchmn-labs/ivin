import type { AtomRegistry } from "effect/reactivity"
import type { UiContext, UiPlugin } from "@ivin/plugin-api/ui"
import { commandHandlersAtom, commandsAtom } from "../../command/atoms/commands.ts"
import { addCommandHandler } from "../../command/atoms/run-command.ts"
import { defaultKeybindingsAtom } from "../../keybinding/atoms/keybindings.ts"
import { contributionsAtom } from "./contributions.ts"

export interface UiPluginEntry {
  readonly manifest: { readonly id: string }
  readonly activate: UiPlugin
}

export const activatePlugin = (
  registry: AtomRegistry.AtomRegistry,
  { manifest, activate }: UiPluginEntry,
): (() => void) => {
  const pluginId = manifest.id
  const removeOwn = () => {
    registry.set(
      contributionsAtom,
      registry.get(contributionsAtom).filter((c) => c.pluginId !== pluginId),
    )
    registry.set(
      commandsAtom,
      registry.get(commandsAtom).filter((c) => c.pluginId !== pluginId),
    )
    registry.set(
      commandHandlersAtom,
      registry.get(commandHandlersAtom).filter((h) => h.owner !== pluginId),
    )
    registry.set(
      defaultKeybindingsAtom,
      registry.get(defaultKeybindingsAtom).filter((k) => k.pluginId !== pluginId),
    )
  }

  const ctx: UiContext = {
    pluginId,
    slots: {
      add: (slot, component, options) => {
        const id = `${pluginId}/${options?.name ?? slot}`
        const current = registry.get(contributionsAtom)
        if (current.some((c) => c.id === id)) throw new Error(`Contribution ${id} already exists`)
        registry.set(contributionsAtom, [
          ...current,
          {
            id,
            pluginId,
            slot,
            component: component,
            order: options?.order ?? 0,
            replaces: options?.replaces,
            tool: options?.tool,
          },
        ])
      },
    },
    commands: {
      register: (id, { title, run }) => {
        const current = registry.get(commandsAtom)
        if (current.some((c) => c.id === id)) throw new Error(`Command ${id} already exists`)
        registry.set(commandsAtom, [...current, { id, title, pluginId }])
        addCommandHandler(registry, id, run, pluginId)
      },
    },
    keybindings: {
      add: ({ key, command, when }) =>
        registry.set(defaultKeybindingsAtom, [
          ...registry.get(defaultKeybindingsAtom),
          { key, command, when: when ?? null, pluginId },
        ]),
    },
  }

  try {
    activate(ctx)
  } catch (error) {
    console.error(`plugin ${pluginId} failed to activate`, error)
    removeOwn()
  }
  return removeOwn
}
