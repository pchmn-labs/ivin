import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { subViewKey, type SubView } from "@ivin/contracts/tab"
import type { ViewPlacement } from "@ivin/plugin-api/ui"
import { Exit } from "effect"
import type { CoreMenuItem } from "../../../core/components/menu/menu.tsx"
import { notify } from "../../../core/components/notification/notification-manager.ts"
import { moveViewAtom } from "../atoms/move-view.ts"
import { declaredViewsAtom } from "../atoms/registered-views.ts"
import { moveTargets, placementIcons, placementNames } from "../rules/placement.ts"
import { declaredViewOf } from "../rules/view-title.ts"
import { focusViewTab } from "../adapters/view-tabs.ts"

// The "Move to" section of a view's menu; empty for a view with one placement.
export function useMoveTo(
  sessionId: string,
  workingFolder: string,
  view: SubView,
  from: ViewPlacement,
): ReadonlyArray<CoreMenuItem> {
  const declaration = declaredViewOf(useAtomValue(declaredViewsAtom), view)
  const move = useAtomSet(moveViewAtom, { mode: "promiseExit" })
  const targets = moveTargets(declaration, from)
  if (targets.length === 0) return []
  const moveTo = async (to: ViewPlacement) => {
    const exit = await move({ sessionId, workingFolder, view, from, to })
    if (Exit.isFailure(exit)) return notify({ message: "Could not move the view." })
    // A dialog takes the focus itself.
    if (to !== "dialog") focusViewTab(subViewKey(view))
  }
  return [
    { heading: "Move to" },
    ...targets.map((to) => ({
      label: placementNames[to],
      icon: placementIcons[to],
      onSelect: () => void moveTo(to),
    })),
  ]
}

// A tab's right-click menu: its "Move to" section, then Close.
export const tabMenu = (
  moveTo: ReadonlyArray<CoreMenuItem>,
  close: () => void,
): ReadonlyArray<CoreMenuItem> => [
  ...moveTo,
  ...(moveTo.length > 0 ? ["separator" as const] : []),
  { label: "Close", icon: "x", onSelect: close },
]
