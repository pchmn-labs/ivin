import { Atom } from "effect/reactivity"
import { projectsAtom } from "./list-projects.ts"

export const selectedProjectAtom = Atom.readable((get) => {
  const { projects, selectedPath } = get(projectsAtom.value)
  return projects.find((project) => project.path === selectedPath) ?? null
})
