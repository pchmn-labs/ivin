export const selectionAfterRemoval = (order: readonly string[], removed: string): string | null => {
  const index = order.indexOf(removed)
  if (index === -1) return null
  return order[index + 1] ?? order[index - 1] ?? null
}
