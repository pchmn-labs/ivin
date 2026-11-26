import type { ComponentType } from "react"
import type { SlotName, SlotProps, UiContext } from "@ivin/plugin-api/ui"

export const activatePlugin = (activate: (ctx: UiContext) => void, pluginId: string) => {
  const added: Array<{ slot: string; component: ComponentType<never> }> = []
  activate({
    pluginId,
    slots: {
      add: (slot, component) =>
        void added.push({ slot, component: component as ComponentType<never> }),
    },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    views: { register: () => undefined, open: async () => undefined },
    notify: () => undefined,
    fetch: () => Promise.reject(new Error("No network in tests.")),
    sidebar: { showPanel: () => undefined },
  })
  return <N extends SlotName>(name: N) =>
    added.find((a) => a.slot === name)!.component as unknown as ComponentType<SlotProps[N]>
}
