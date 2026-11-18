export const reorder = (current: readonly string[], named: readonly string[]): string[] => {
  const known = new Set(current)
  const first = [...new Set(named)].filter((id) => known.has(id))
  const placed = new Set(first)
  return [...first, ...current.filter((id) => !placed.has(id))]
}

// The ids of the bar once `moved` is dropped before or after `target`.
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
