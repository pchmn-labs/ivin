export const projectName = (path: string): string => {
  const segments = path.split(/[\\/]+/).filter((segment) => segment !== "")
  return segments.at(-1) ?? path
}
