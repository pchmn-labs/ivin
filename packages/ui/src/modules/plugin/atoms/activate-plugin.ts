import type { Atom, AtomRegistry } from "effect/reactivity"
import type { UiContext, UiPlugin } from "@ivin/plugin-api/ui"
import { commandHandlersAtom, commandsAtom } from "../../command/atoms/commands.ts"
import { addCommandHandler } from "../../command/atoms/run-command.ts"
import { defaultKeybindingsAtom } from "../../keybinding/atoms/keybindings.ts"
import { pluginFileUrl } from "../rules/plugin-file-url.ts"
import {
  contributionsAtom,
  editorContributionsAtom,
  fileIconContributionsAtom,
} from "./contributions.ts"

export interface UiPluginEntry {
  readonly manifest: { readonly id: string }
  readonly activate: UiPlugin
}

export const activatePlugin = (
  registry: AtomRegistry.AtomRegistry,
  { manifest, activate }: UiPluginEntry,
  showSidebarPanel: (contributionId: string) => void,
  onFailure?: (error: unknown) => void,
): (() => void) => {
  const pluginId = manifest.id
  const removeFrom = <T extends { readonly pluginId: string | null }>(
    atom: Atom.Writable<ReadonlyArray<T>>,
  ) =>
    registry.set(
      atom,
      registry.get(atom).filter((item) => item.pluginId !== pluginId),
    )
  let active = true
  const removeOwn = () => {
    active = false
    removeFrom(contributionsAtom)
    removeFrom(commandsAtom)
    removeFrom(commandHandlersAtom)
    removeFrom(defaultKeybindingsAtom)
    removeFrom(editorContributionsAtom)
    removeFrom(fileIconContributionsAtom)
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
            title: options?.title,
            badge: options?.badge,
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
    editorExtensions: {
      add: (extension) =>
        registry.set(editorContributionsAtom, [
          ...registry.get(editorContributionsAtom),
          { pluginId, extension },
        ]),
    },
    fileIcons: {
      // A plugin may add its icons once something it loads arrives, after it was turned off.
      add: (icon) => {
        if (!active) return
        registry.set(fileIconContributionsAtom, [
          ...registry.get(fileIconContributionsAtom),
          { pluginId, icon },
        ])
      },
    },
    fileUrl: (path) => pluginFileUrl(pluginId, path),
    sidebar: {
      showPanel: (name = "sidebar.panel") => showSidebarPanel(`${pluginId}/${name}`),
    },
  }

  try {
    activate(ctx)
  } catch (error) {
    console.error(`plugin ${pluginId} failed to activate`, error)
    removeOwn()
    onFailure?.(error)
  }
  return removeOwn
}
