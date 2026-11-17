import type { AtomRegistry } from "effect/reactivity"
import type { UiContext, UiPlugin } from "@ivin/plugin-api/ui"
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
  const removeOwn = () =>
    registry.set(
      contributionsAtom,
      registry.get(contributionsAtom).filter((c) => c.pluginId !== pluginId),
    )

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
  }

  try {
    activate(ctx)
  } catch (error) {
    console.error(`plugin ${pluginId} failed to activate`, error)
    removeOwn()
  }
  return removeOwn
}
