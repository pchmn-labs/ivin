import { AtomRegistry } from "effect/reactivity"
import { expect, test } from "vitest"
import { defineUi } from "@ivin/plugin-api/ui"
import { activatePlugin, type UiPluginEntry } from "./activate-plugin.ts"
import { commandsAtom } from "../../command/atoms/commands.ts"
import { runCommand } from "../../command/atoms/run-command.ts"
import { defaultKeybindingsAtom } from "../../keybinding/atoms/keybindings.ts"
import { contributionsAtom } from "./contributions.ts"

const plugin = (id: string): UiPluginEntry => ({
  manifest: { id },
  activate: defineUi((ctx) => ctx.slots.add("composer.status", () => null)),
})

test("deactivating a plugin removes only its own contributions", () => {
  const registry = AtomRegistry.make()
  const deactivateA = activatePlugin(registry, plugin("a"), () => undefined)
  activatePlugin(registry, plugin("b"), () => undefined)
  expect(registry.get(contributionsAtom).map((c) => c.id)).toEqual([
    "a/composer.status",
    "b/composer.status",
  ])

  deactivateA()
  expect(registry.get(contributionsAtom).map((c) => c.id)).toEqual(["b/composer.status"])
})

test("a plugin's commands and default keybindings run while it is active, and leave with it", () => {
  const registry = AtomRegistry.make()
  const ran: Array<string> = []
  const deactivate = activatePlugin(
    registry,
    {
      manifest: { id: "prs" },
      activate: defineUi((ctx) => {
        ctx.commands.register("prs.refresh", {
          title: "Refresh PRs",
          run: () => ran.push("refresh"),
        })
        ctx.keybindings.add({ key: "mod+r", command: "prs.refresh", when: "sessionList" })
      }),
    },
    () => undefined,
  )

  expect(registry.get(commandsAtom).find((c) => c.id === "prs.refresh")?.title).toBe("Refresh PRs")
  expect(registry.get(defaultKeybindingsAtom)).toContainEqual({
    key: "mod+r",
    command: "prs.refresh",
    when: "sessionList",
    pluginId: "prs",
  })
  expect(runCommand(registry, "prs.refresh")).toBe(true)
  expect(ran).toEqual(["refresh"])

  deactivate()
  expect(registry.get(commandsAtom).some((c) => c.id === "prs.refresh")).toBe(false)
  expect(registry.get(defaultKeybindingsAtom).some((k) => k.pluginId === "prs")).toBe(false)
  expect(runCommand(registry, "prs.refresh")).toBe(false)
})
