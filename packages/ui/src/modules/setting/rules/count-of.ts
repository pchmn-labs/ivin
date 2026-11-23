// Null when the text is not a whole number of at least `min`.
export const countOf = (text: string, min: number): number | null => {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const count = Number(trimmed)
  return Number.isSafeInteger(count) && count >= min ? count : null
}
