export interface RankedFile {
  readonly path: string
  // Positions in the file's name of the query's letters; null when they only match across the path.
  readonly nameMatch: ReadonlyArray<number> | null
}

// The positions of `query`'s letters in `text`, in order, each as early as it can be; null if one is missing.
const lettersIn = (text: string, query: string): Array<number> | null => {
  const lower = text.toLowerCase()
  const found: Array<number> = []
  let from = 0
  for (const letter of query) {
    const at = lower.indexOf(letter, from)
    if (at === -1) return null
    found.push(at)
    from = at + 1
  }
  return found
}

// The tightest run of the query's letters: try each place its first letter appears.
const tightest = (text: string, query: string): Array<number> | null => {
  let best: Array<number> | null = null
  const lower = text.toLowerCase()
  for (let start = lower.indexOf(query[0] ?? ""); start !== -1;) {
    const rest = lettersIn(text.slice(start + 1), query.slice(1))
    if (rest === null) break
    const found = [start, ...rest.map((at) => at + start + 1)]
    if (best === null || spread(found) < spread(best)) best = found
    start = lower.indexOf(query[0] ?? "", start + 1)
  }
  return best
}

const spread = (found: ReadonlyArray<number>) => (found.at(-1) ?? 0) - (found[0] ?? 0)

// Above any name match's score, so a match across the path always ranks after.
const PATH_MATCH = 1_000_000

export const rankFiles = (
  paths: ReadonlyArray<string>,
  query: string,
  limit: number,
): ReadonlyArray<RankedFile> => {
  const letters = query.replaceAll(/\s/g, "").toLowerCase()
  if (letters === "")
    return [...paths]
      .sort()
      .slice(0, limit)
      .map((path) => ({ path, nameMatch: null }))
  const scored: Array<RankedFile & { readonly score: number }> = []
  for (const path of paths) {
    const nameStart = path.lastIndexOf("/") + 1
    const nameMatch = tightest(path.slice(nameStart), letters)
    if (nameMatch !== null) {
      // A tighter run first, then one nearer the name's start.
      scored.push({ path, nameMatch, score: spread(nameMatch) * 1000 + (nameMatch[0] ?? 0) })
      continue
    }
    const pathMatch = tightest(path, letters)
    if (pathMatch !== null)
      scored.push({ path, nameMatch: null, score: PATH_MATCH + spread(pathMatch) })
  }
  return scored
    .sort(
      (a, b) => a.score - b.score || a.path.length - b.path.length || (a.path < b.path ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ path, nameMatch }) => ({ path, nameMatch }))
}
