interface Placed {
  readonly id: string
  readonly slot: string
  readonly order: number
  readonly replaces: string | undefined
  readonly tool: string | undefined
}

export const visibleContributions = <T extends Placed>(
  all: ReadonlyArray<T>,
  slot: string,
  tool?: string,
): ReadonlyArray<T> => {
  const matching = all
    .filter((c) => c.slot === slot && (c.tool === undefined || c.tool === tool))
    .toSorted((a, b) => a.order - b.order)

  const shown = new Map<string, boolean>()
  const isShown = (c: T): boolean => {
    const known = shown.get(c.id)
    if (known !== undefined) return known
    // Provisional answer that breaks a replace cycle.
    shown.set(c.id, true)
    const result = !matching.some((other) => other.replaces === c.id && isShown(other))
    shown.set(c.id, result)
    return result
  }
  return matching.filter(isShown)
}
