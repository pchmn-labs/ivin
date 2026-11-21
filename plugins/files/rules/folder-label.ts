// The working folder as the user knows it: relative to the project when inside it.
export const folderLabel = (workingFolder: string, projectPath: string, projectName: string) => {
  if (workingFolder === projectPath) return projectName
  return workingFolder.startsWith(`${projectPath}/`)
    ? workingFolder.slice(projectPath.length + 1)
    : workingFolder
}
