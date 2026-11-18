export const reorder = (current: readonly string[], named: readonly string[]): string[] => {
  const known = new Set(current)
  const first = [...new Set(named)].filter((id) => known.has(id))
  const placed = new Set(first)
  return [...first, ...current.filter((id) => !placed.has(id))]
}
