import { AtomRegistry } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { EditorView } from "@ivin/plugin-api/editor"
import { defineUi } from "@ivin/plugin-api/ui"
import { activatePlugin, type UiPluginEntry } from "./activate-plugin.ts"
import { commandsAtom } from "../../command/atoms/commands.ts"
import { runCommand } from "../../command/atoms/run-command.ts"
import { defaultKeybindingsAtom } from "../../keybinding/atoms/keybindings.ts"
import { contributionsAtom, editorExtensionsAtom, fileIconsAtom } from "./contributions.ts"
import { makeTestRegistry } from "../../../core/test-registry.ts"

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

test("a plugin's editor extensions reach the file editor while it is active, and leave with it", () => {
  const registry = AtomRegistry.make()
  const mine = EditorView.contentAttributes.of({ "data-mine": "yes" })
  const deactivate = activatePlugin(
    registry,
    { manifest: { id: "vim" }, activate: defineUi((ctx) => ctx.editorExtensions.add(mine)) },
    () => undefined,
  )
  expect(registry.get(editorExtensionsAtom)).toEqual([mine])

  deactivate()
  expect(registry.get(editorExtensionsAtom)).toEqual([])
})

test("a plugin's file icons leave with it, and one it adds once turned off is never added", () => {
  const registry = AtomRegistry.make()
  let addLater = () => undefined as void
  const deactivate = activatePlugin(
    registry,
    {
      manifest: { id: "icons" },
      activate: defineUi((ctx) => {
        ctx.fileIcons.add(() => "now")
        addLater = () => ctx.fileIcons.add(() => "later")
      }),
    },
    () => undefined,
  )
  expect(
    registry.get(fileIconsAtom).map((icon) => icon({ name: "a", folder: false, open: false })),
  ).toEqual(["now"])

  deactivate()
  addLater()
  expect(registry.get(fileIconsAtom)).toEqual([])
})

test("a plugin's file URL is served from its own folder", () => {
  const registry = AtomRegistry.make()
  let url = ""
  activatePlugin(
    registry,
    {
      manifest: { id: "file-icons" },
      activate: defineUi((ctx) => void (url = ctx.fileUrl("icons/a.svg"))),
    },
    () => undefined,
  )
  expect(url).toBe("ivin-plugin://file-icons/icons/a.svg")
})

test("an editor extension CodeMirror rejects is turned off and reported against its plugin", async () => {
  const { registry, server } = makeTestRegistry()
  const good = EditorView.contentAttributes.of({ "data-good": "yes" })
  const invalid = { extension: 42 } as never
  activatePlugin(
    registry,
    {
      manifest: { id: "vim" },
      activate: defineUi((ctx) => {
        ctx.editorExtensions.add(invalid)
        ctx.editorExtensions.add(good)
      }),
    },
    () => undefined,
  )
  expect(registry.get(editorExtensionsAtom)).toEqual([good])
  await vi.waitFor(() => expect(server.pluginFailures).toHaveLength(1))
  expect(server.pluginFailures[0]?.id).toBe("vim")
})

test("a file icon function that throws is turned off, reported once, and the others still draw", async () => {
  const { registry, server } = makeTestRegistry()
  const row = { name: "a", folder: false, open: false }
  activatePlugin(
    registry,
    {
      manifest: { id: "icons" },
      activate: defineUi((ctx) => {
        ctx.fileIcons.add(() => {
          throw new Error("boom")
        })
        ctx.fileIcons.add(() => "fallback")
      }),
    },
    () => undefined,
  )
  const draw = () => registry.get(fileIconsAtom).map((icon) => icon(row))
  expect(draw()).toEqual([null, "fallback"])
  expect(draw()).toEqual([null, "fallback"])
  await vi.waitFor(() => expect(server.pluginFailures).toHaveLength(1))
  expect(server.pluginFailures[0]?.id).toBe("icons")
})
