import type { ComponentType } from "react"
import { Atom, type AtomRegistry } from "effect/reactivity"
import type { SlotName, UiContext, UiPlugin } from "@ivin/plugin-api/ui"

export interface Contribution {
  readonly id: string
  readonly pluginId: string
  readonly slot: SlotName
  readonly component: ComponentType<never>
  readonly order: number
  readonly replaces: string | undefined
  readonly tool: string | undefined
}

export interface UiPluginEntry {
  readonly manifest: { readonly id: string }
  readonly activate: UiPlugin
}

export const contributionsAtom = Atom.make<ReadonlyArray<Contribution>>([]).pipe(Atom.keepAlive)

// Returns the function that deactivates the plugin and removes what it added.
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
            component: component as ComponentType<never>,
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

// Ascending order, ties by registration; a contribution is hidden when another one shown names it in `replaces`.
export const visibleContributions = (
  all: ReadonlyArray<Contribution>,
  slot: SlotName,
  tool?: string,
): ReadonlyArray<Contribution> => {
  const matching = all
    .filter((c) => c.slot === slot && (c.tool === undefined || c.tool === tool))
    .toSorted((a, b) => a.order - b.order)
  const replaced = new Set(matching.flatMap((c) => (c.replaces === undefined ? [] : [c.replaces])))
  return matching.filter((c) => !replaced.has(c.id))
}
