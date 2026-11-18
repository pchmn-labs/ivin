import { Atom } from "effect/reactivity"
import { openProjectsAtom } from "./list-projects.ts"

export const selectedProjectAtom = Atom.readable((get) => {
  const { projects, selectedPath } = get(openProjectsAtom.value)
  return projects.find((project) => project.path === selectedPath) ?? null
})
