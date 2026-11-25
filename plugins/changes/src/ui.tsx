import { lazy } from "react"
import { defineUi } from "@ivin/plugin-api/ui"
import { AREA } from "./rules/groups.ts"
import type { OnScreen } from "./rules/on-screen.ts"
import { DiffViewOf } from "./ui/diff-view.tsx"
import { ChangesBadge } from "./ui/changes-badge.tsx"

const ChangesPanel = lazy(() =>
  import("./ui/changes-panel.tsx").then((m) => ({ default: m.ChangesPanel })),
)

export const activate = defineUi((ctx) => {
  const onScreen: OnScreen = { current: null }
  ctx.views.register("diff", {
    component: DiffViewOf,
    title: ({ path, kind }) =>
      typeof path === "string"
        ? `${path.slice(path.lastIndexOf("/") + 1)} ${kind === "committed" ? "committed" : "diff"}`
        : "Diff",
  })
  ctx.slots.add("sidebar.panel", () => <ChangesPanel onScreen={onScreen} />, {
    name: "panel",
    title: "Changes",
    badge: ChangesBadge,
  })
  ctx.commands.register("changes.show", {
    title: "Show changes",
    run: () => ctx.sidebar.showPanel("panel"),
  })
  ctx.commands.register("changes.discard", {
    title: "Discard the focused change",
    run: () => onScreen.current?.discardFocused(),
  })
  ctx.commands.register("changes.discardAll", {
    title: "Discard all uncommitted changes",
    run: () => onScreen.current?.discardAll(),
  })
  ctx.keybindings.add({ key: "mod+3", command: "changes.show" })
  ctx.keybindings.add({ key: "backspace", command: "changes.discard", when: AREA })
  ctx.keybindings.add({ key: "mod+backspace", command: "changes.discardAll", when: AREA })
})
