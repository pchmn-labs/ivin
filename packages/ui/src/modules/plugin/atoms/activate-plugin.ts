import type { Atom, AtomRegistry } from "effect/reactivity"
import type { ViewDeclaration } from "@ivin/contracts/plugin"
import { decodeFetchResponse, encodeFetchRequest } from "@ivin/contracts/plugin-fetch"
import type { UiContext, UiPlugin } from "@ivin/plugin-api/ui"
import { declaredViewsAtom, registeredViewsAtom } from "../../view/atoms/registered-views.ts"
import { runOpenView } from "../../view/atoms/open-view.ts"
import { openViewFailure } from "../../tab/rules/sub-view-failure.ts"
import { commandHandlersAtom, commandsAtom } from "../../command/atoms/commands.ts"
import { notify } from "../../../core/components/notification/notification-manager.ts"
import { addCommandHandler } from "../../command/atoms/run-command.ts"
import { defaultKeybindingsAtom } from "../../keybinding/atoms/keybindings.ts"
import { pluginFileUrl } from "../rules/plugin-file-url.ts"
import {
  contributionsAtom,
  editorContributionsAtom,
  fileIconContributionsAtom,
} from "./contributions.ts"
import { pluginFetch } from "./plugin-fetch.ts"
import { reportPluginFailureAtom } from "./report-plugin-failure.ts"

export interface UiPluginEntry {
  readonly manifest: { readonly id: string; readonly views?: ReadonlyArray<ViewDeclaration> }
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
  const reportFailure = (what: string, error: unknown) => {
    console.error(`plugin ${pluginId} ${what}`, error)
    registry.set(reportPluginFailureAtom, {
      id: pluginId,
      reason: `Its ${what} and was turned off: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
  let active = true
  const removeOwn = () => {
    active = false
    removeFrom(contributionsAtom)
    removeFrom(commandsAtom)
    removeFrom(commandHandlersAtom)
    removeFrom(defaultKeybindingsAtom)
    removeFrom(editorContributionsAtom)
    removeFrom(fileIconContributionsAtom)
    removeFrom(declaredViewsAtom)
    removeFrom(registeredViewsAtom)
  }
  const declared = manifest.views ?? []
  registry.set(declaredViewsAtom, [
    ...registry.get(declaredViewsAtom),
    ...declared.map((view) => ({ ...view, id: `${pluginId}/${view.name}`, pluginId })),
  ])

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
    notify,
    fetch: async (input, init) =>
      decodeFetchResponse(
        await pluginFetch(registry, pluginId, await encodeFetchRequest(input, init)),
      ),
    keybindings: {
      add: ({ key, command, when }) =>
        registry.set(defaultKeybindingsAtom, [
          ...registry.get(defaultKeybindingsAtom),
          { key, command, when: when ?? null, pluginId },
        ]),
    },
    editorExtensions: {
      // Checked once CodeMirror has loaded, so the extension reaches the editors a moment later.
      add: (extension) => {
        void import("@ivin/plugin-api/editor").then(({ EditorState }) => {
          if (!active) return
          try {
            EditorState.create({ extensions: extension })
          } catch (error) {
            reportFailure("editor extension is invalid", error)
            return
          }
          registry.set(editorContributionsAtom, [
            ...registry.get(editorContributionsAtom),
            { pluginId, extension },
          ])
        })
      },
    },
    fileIcons: {
      // A plugin may add its icons once something it loads arrives, after it was turned off.
      add: (icon) => {
        if (!active) return
        let broken = false
        const guarded: typeof icon = (row) => {
          if (broken) return null
          try {
            return icon(row)
          } catch (error) {
            broken = true
            reportFailure("file icon function threw", error)
            return null
          }
        }
        registry.set(fileIconContributionsAtom, [
          ...registry.get(fileIconContributionsAtom),
          { pluginId, icon: guarded },
        ])
      },
    },
    views: {
      register: (name, { component, title, icon }) => {
        if (!declared.some((view) => view.name === name)) {
          console.error(`plugin ${pluginId} registered the undeclared view ${name}`)
          registry.set(reportPluginFailureAtom, {
            id: pluginId,
            reason: `It registered the view ${name}, which its manifest does not declare under ivin.views.`,
          })
          return
        }
        const id = `${pluginId}/${name}`
        const current = registry.get(registeredViewsAtom)
        if (current.some((view) => view.id === id)) throw new Error(`View ${id} already exists`)
        registry.set(registeredViewsAtom, [
          ...current,
          { id, pluginId, component, ...(title && { title }), ...(icon && { icon }) },
        ])
      },
      open: (sessionId, view, params, options) =>
        runOpenView(registry, { sessionId, view, params, placement: options?.placement }, (error) =>
          openViewFailure(error, view),
        ),
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
