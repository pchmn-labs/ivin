import { AtomRegistry } from "effect/reactivity"
import { expect, test } from "vitest"
import { defineUi } from "@ivin/plugin-api/ui"
import { activatePlugin, type UiPluginEntry } from "./activate-plugin.ts"
import { contributionsAtom } from "./contributions.ts"

const plugin = (id: string): UiPluginEntry => ({
  manifest: { id },
  activate: defineUi((ctx) => ctx.slots.add("composer.status", () => null)),
})

test("deactivating a plugin removes only its own contributions", () => {
  const registry = AtomRegistry.make()
  const deactivateA = activatePlugin(registry, plugin("a"))
  activatePlugin(registry, plugin("b"))
  expect(registry.get(contributionsAtom).map((c) => c.id)).toEqual([
    "a/composer.status",
    "b/composer.status",
  ])

  deactivateA()
  expect(registry.get(contributionsAtom).map((c) => c.id)).toEqual(["b/composer.status"])
})
