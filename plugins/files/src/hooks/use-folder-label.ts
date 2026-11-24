import { useProjects, type Session } from "@ivin/plugin-api/ui"
import { folderLabel } from "../rules/folder-label.ts"

export function useFolderLabel(session: Session) {
  const { projects } = useProjects()
  const project = projects.find((p) => p.path === session.projectPath)
  return folderLabel(session.workingFolder, session.projectPath, project?.name ?? "")
}
