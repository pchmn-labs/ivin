export const neighbourProject = (
  projects: ReadonlyArray<{ readonly path: string }>,
  selectedPath: string | null,
  step: 1 | -1,
): string | null => {
  const index = projects.findIndex((project) => project.path === selectedPath)
  if (index < 0) return null
  return projects[index + step]?.path ?? null
}
