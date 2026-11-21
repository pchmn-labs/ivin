// The names of a path relative to the working folder, or null when it could leave it.
export const relativeNames = (path: string): ReadonlyArray<string> | null => {
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return null
  const names = path.split("/").filter((name) => name !== "" && name !== ".")
  return names.includes("..") ? null : names
}

export const isWithin = (folder: string, path: string): boolean =>
  path === folder || path.startsWith(folder.endsWith("/") ? folder : `${folder}/`)
