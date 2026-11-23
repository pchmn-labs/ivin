interface Panel {
  readonly id: string
  readonly replaces: string | undefined
}

// `picked` may name a panel another plugin replaces, or one kept from a launch that had it.
export const shownPanel = <T extends Panel>(
  all: ReadonlyArray<T>,
  visible: ReadonlyArray<T>,
  picked: string,
): T | undefined => {
  const seen = new Set<string>()
  let id: string | undefined = picked
  while (id !== undefined && !seen.has(id)) {
    seen.add(id)
    const current: string = id
    const found = visible.find((panel) => panel.id === current)
    if (found !== undefined) return found
    id = all.find((panel) => panel.replaces === current)?.id
  }
  return visible[0]
}
