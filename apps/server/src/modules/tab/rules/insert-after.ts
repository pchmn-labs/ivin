export const insertAfter = (order: readonly string[], id: string, after: string): string[] => {
  const rest = order.filter((other) => other !== id)
  const at = rest.indexOf(after)
  return at < 0 ? [...rest, id] : [...rest.slice(0, at + 1), id, ...rest.slice(at + 1)]
}
