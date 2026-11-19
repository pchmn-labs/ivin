const keyOf = (name: string) => `ivin.size.${name}`

export const readStoredSize = (name: string): number | null => {
  const size = Number(localStorage.getItem(keyOf(name)))
  return Number.isFinite(size) && size > 0 ? size : null
}

export const storeSize = (name: string, size: number | null): void => {
  if (size === null) localStorage.removeItem(keyOf(name))
  else localStorage.setItem(keyOf(name), String(Math.round(size)))
}
