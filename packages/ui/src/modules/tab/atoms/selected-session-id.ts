import { Atom } from "effect/reactivity"
import { selectedProjectAtom } from "../../project/atoms/selected-project.ts"
import { tabsOf } from "./list-tabs.ts"

export const selectedSessionIdAtom = Atom.readable((get) => {
  const project = get(selectedProjectAtom)
  return project === null ? null : get(tabsOf(project.path).value).selectedSessionId
})
