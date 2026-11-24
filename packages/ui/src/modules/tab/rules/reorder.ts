export const reorder = (current: readonly string[], named: readonly string[]): string[] => {
  const known = new Set(current)
  const first = [...new Set(named)].filter((id) => known.has(id))
  const placed = new Set(first)
  return [...first, ...current.filter((id) => !placed.has(id))]
}

// Null when the tab is not in the bar or already at that end.
export const moveBy = (
  ids: ReadonlyArray<string>,
  moved: string,
  by: -1 | 1,
): ReadonlyArray<string> | null => {
  const at = ids.indexOf(moved)
  const neighbour = ids[at + by]
  if (at < 0 || neighbour === undefined) return null
  return moveTab(ids, moved, neighbour, by < 0 ? "before" : "after")
}

export const moveTab = (
  ids: ReadonlyArray<string>,
  moved: string,
  target: string,
  placement: "before" | "after",
): ReadonlyArray<string> => {
  if (moved === target) return ids
  const rest = ids.filter((id) => id !== moved)
  const at = rest.indexOf(target) + (placement === "after" ? 1 : 0)
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}
