// An app opened from the Dock gets a bare PATH, without the folders where agents are installed.
export const agentPath = (
  appPath: string,
  shellPath: ReadonlyArray<string> | null,
  cliFolder: string | null,
): string => {
  if (shellPath === null) return appPath
  const folders = [cliFolder, ...shellPath, ...appPath.split(":")].filter(
    (folder): folder is string => folder !== null && folder !== "",
  )
  return [...new Set(folders)].join(":")
}
