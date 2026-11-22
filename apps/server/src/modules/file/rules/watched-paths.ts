export const isUnderGit = (path: string): boolean => path === ".git" || path.startsWith(".git/")

export const isGitStateChange = (path: string): boolean =>
  path === ".git/index" || path === ".git/HEAD"

export const ancestorsOf = (path: string): ReadonlyArray<string> => {
  const names = path.split("/")
  return names.map((_, index) => names.slice(0, index + 1).join("/"))
}
