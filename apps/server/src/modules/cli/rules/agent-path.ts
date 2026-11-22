export const agentPath = (appPath: string, shellFolders: ReadonlyArray<string> | null): string => {
  if (shellFolders === null) return appPath
  const shell = shellFolders.filter((folder) => folder !== "")
  const app = appPath.split(":").filter((folder) => folder !== "")
  const firstShared = app.findIndex((folder) => shell.includes(folder))
  // What was put before the shell's folders (ivin's command, a test's fake agent) keeps its place.
  const leading = firstShared === -1 ? app : app.slice(0, firstShared)
  return [...new Set([...leading, ...shell, ...app])].join(":")
}
