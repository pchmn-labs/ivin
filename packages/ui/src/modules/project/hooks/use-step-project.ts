import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { projectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { neighbourProject } from "../rules/neighbour-project.ts"

export function useStepProject() {
  const { projects, selectedPath } = useAtomValue(projectsAtom.value)
  const selectProject = useAtomSet(selectProjectAtom)
  const target = (step: 1 | -1) => neighbourProject(projects, selectedPath, step)
  return {
    canStep: (step: 1 | -1) => target(step) !== null,
    step: (step: 1 | -1) => {
      const path = target(step)
      if (path !== null) selectProject(path)
    },
  }
}
