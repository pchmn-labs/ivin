export const agentPath = (
  appPath: string,
  shellFolders: ReadonlyArray<string> | null,
  cliFolder: string | null,
): string => {
  if (shellFolders === null) return appPath
  const folders = [cliFolder, ...shellFolders, ...appPath.split(":")].filter(
    (folder): folder is string => folder !== null && folder !== "",
  )
  return [...new Set(folders)].join(":")
}
