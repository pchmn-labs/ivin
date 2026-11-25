import type { SubView } from "@ivin/contracts/tab"
import type { DeclaredView, RegisteredView } from "./view-types.ts"

export const registeredViewOf = (
  registered: ReadonlyArray<RegisteredView>,
  view: SubView,
): RegisteredView | undefined => registered.find((candidate) => candidate.id === view.view)

export const declaredViewOf = (
  declared: ReadonlyArray<DeclaredView>,
  view: SubView,
): DeclaredView | undefined => declared.find((candidate) => candidate.id === view.view)

// A title function that throws must not take the tab row down with it.
export const viewTitle = (
  registration: RegisteredView | undefined,
  declaration: DeclaredView | undefined,
  view: SubView,
): string => {
  try {
    return registration?.title?.(view.params) ?? declaration?.title ?? view.view
  } catch {
    return declaration?.title ?? view.view
  }
}
