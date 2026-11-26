import { lazy } from "react"
import { defineUi } from "@ivin/plugin-api/ui"
import type { PluginState } from "./rules/plugin-state.ts"
import { nameOf } from "./rules/paths.ts"
import { FileViewOf } from "./ui/file-view.tsx"
import { GoToFileHost } from "./ui/go-to-file-host.tsx"

const FilesPanel = lazy(() =>
  import("./ui/files-panel.tsx").then((m) => ({ default: m.FilesPanel })),
)

export const activate = defineUi((ctx) => {
  const state: PluginState = {
    remembered: new Map(),
    showIgnored: false,
    collapseAll: new Set(),
    toggleIgnored: new Set(),
    openGoToFile: new Set(),
  }
  ctx.views.register("file", {
    component: FileViewOf,
    title: ({ path }) => (typeof path === "string" ? nameOf(path) : "File"),
  })
  ctx.slots.add("sidebar.panel", () => <FilesPanel state={state} />, {
    name: "panel",
    title: "Files",
    // Before Changes, and both before the panels of plugins that set no order.
    order: -2,
  })
  ctx.slots.add("window.overlay", () => <GoToFileHost state={state} />, { name: "goToFile" })
  ctx.commands.register("files.show", {
    title: "Show files",
    run: () => ctx.sidebar.showPanel("panel"),
  })
  ctx.keybindings.add({ key: "mod+2", command: "files.show" })
  ctx.commands.register("files.collapseAll", {
    title: "Collapse all folders",
    run: () => state.collapseAll.forEach((run) => run()),
  })
  ctx.commands.register("files.toggleIgnored", {
    title: "Show or hide ignored files",
    run: () => {
      if (state.toggleIgnored.size === 0) state.showIgnored = !state.showIgnored
      state.toggleIgnored.forEach((run) => run())
    },
  })
  ctx.commands.register("files.goToFile", {
    title: "Go to file",
    run: () => state.openGoToFile.forEach((run) => run()),
  })
  ctx.keybindings.add({ key: "mod+p", command: "files.goToFile" })
})
