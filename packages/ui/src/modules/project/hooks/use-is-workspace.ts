import { useAtomValue } from "@effect/atom-react"
import { projectsAtom } from "../atoms/list-projects.ts"

export const useIsWorkspace = (projectPath: string) =>
  useAtomValue(projectsAtom.value).projects.some(
    (project) => project.path === projectPath && project.workspace,
  )
