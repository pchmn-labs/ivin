import { useAtomValue } from "@effect/atom-react"
import { projectsAtom } from "../atoms/list-projects.ts"

export const useIsWorkspace = (projectPath: string) => useWorkspaceFolders(projectPath) !== null

// The project folders of a workspace; null for a project of one folder.
export const useWorkspaceFolders = (projectPath: string) => {
  const project = useAtomValue(projectsAtom.value).projects.find((p) => p.path === projectPath)
  return project?.workspace === true ? project.folders : null
}
