// Same rule as the server: named ids first, the others after, in their order.
export const reorderTabs = <T extends { readonly sessionId: string }>(
  tabs: ReadonlyArray<T>,
  sessionIds: ReadonlyArray<string>,
): ReadonlyArray<T> => [
  ...sessionIds.flatMap((id) => tabs.filter((tab) => tab.sessionId === id)),
  ...tabs.filter((tab) => !sessionIds.includes(tab.sessionId)),
]

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
