import { useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import type { IconName } from "../../../core/components/icon/icon.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { fileName } from "../../file/rules/file-name.ts"
import { fileIconsAtom } from "../../plugin/atoms/contributions.ts"
import { fileIconOf } from "../../plugin/rules/file-icon.ts"
import { declaredViewsAtom, registeredViewsAtom } from "../atoms/registered-views.ts"
import { declaredViewOf, registeredViewOf, viewTitle } from "../rules/view-title.ts"

export function useViewLook(view: SubView) {
  const registration = registeredViewOf(useAtomValue(registeredViewsAtom), view)
  const declaration = declaredViewOf(useAtomValue(declaredViewsAtom), view)
  const fileIcons = useAtomValue(fileIconsAtom)
  let icon = null
  try {
    icon = registration?.icon?.(view.params) ?? null
  } catch {
    icon = null
  }
  const path = view.params["path"]
  // A view of a file shows the icon of its type, as the Files tree does.
  const typeIcon =
    typeof path === "string"
      ? fileIconOf(fileIcons, { name: fileName(path), folder: false, open: false })
      : null
  return {
    title: viewTitle(registration, declaration, view),
    icon: icon ?? typeIcon ?? <Icon name={(declaration?.icon ?? "file") as IconName} size={14} />,
  }
}
