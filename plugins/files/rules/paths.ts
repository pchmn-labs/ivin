export const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")))

export const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1)

// The folders holding `path`, outermost first.
export const ancestorsOf = (path: string): ReadonlyArray<string> => {
  const folders: string[] = []
  for (let folder = parentOf(path); folder !== ""; folder = parentOf(folder))
    folders.unshift(folder)
  return folders
}
