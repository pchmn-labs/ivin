export interface RankedFile {
  readonly path: string
  // Positions in the file's name of the query's letters; null when they only match across the path.
  readonly nameMatch: ReadonlyArray<number> | null
}

// Built once per listing; `rankFiles` keeps the last query's matches in it.
export interface FileIndex {
  readonly paths: ReadonlyArray<string>
  readonly lower: ReadonlyArray<string>
  readonly nameStarts: ReadonlyArray<number>
  sorted: ReadonlyArray<string> | null
  last: { readonly letters: string; readonly matches: ReadonlyArray<number> } | null
}

export const indexFiles = (paths: ReadonlyArray<string>): FileIndex => ({
  paths,
  lower: paths.map((path) => path.toLowerCase()),
  nameStarts: paths.map((path) => path.lastIndexOf("/") + 1),
  sorted: null,
  last: null,
})

// `text` and `query` are lower case. The positions of the query's letters in `text`, in order, each as early as it can be; null if one is missing.
const lettersIn = (text: string, query: string, from = 0): Array<number> | null => {
  const found: Array<number> = []
  for (const letter of query) {
    const at = text.indexOf(letter, from)
    if (at === -1) return null
    found.push(at)
    from = at + 1
  }
  return found
}

const hasLetters = (text: string, query: string) => {
  let from = 0
  for (const letter of query) {
    from = text.indexOf(letter, from) + 1
    if (from === 0) return false
  }
  return true
}

// The tightest run of the query's letters: try each place its first letter appears.
const tightest = (text: string, query: string): Array<number> | null => {
  let best: Array<number> | null = null
  for (let start = text.indexOf(query[0] ?? ""); start !== -1;) {
    const rest = lettersIn(text, query.slice(1), start + 1)
    if (rest === null) break
    const found = [start, ...rest]
    if (best === null || spread(found) < spread(best)) best = found
    start = text.indexOf(query[0] ?? "", start + 1)
  }
  return best
}

const spread = (found: ReadonlyArray<number>) => (found.at(-1) ?? 0) - (found[0] ?? 0)

// A tighter run first, then one nearer the name's start.
const nameScore = (spreadOf: number, start: number) => spreadOf * 1000 + start

// Above any name match's score, so a match across the path always ranks after.
const PATH_MATCH = 1_000_000

interface Scored extends RankedFile {
  readonly score: number
}

const beforeScore = (score: number, path: string, b: Scored) =>
  score - b.score || path.length - b.path.length || (path < b.path ? -1 : 1)

const before = (a: Scored, b: Scored) => beforeScore(a.score, a.path, b)

export const rankFiles = (
  index: FileIndex,
  query: string,
  limit: number,
): ReadonlyArray<RankedFile> => {
  const letters = query.replaceAll(/\s/g, "").toLowerCase()
  if (letters === "") {
    index.sorted ??= [...index.paths].sort()
    return index.sorted.slice(0, limit).map((path) => ({ path, nameMatch: null }))
  }
  // Every letter of a longer query is in the files the shorter one matched.
  const last = index.last
  const candidates =
    last !== null && letters.startsWith(last.letters) ? last.matches : index.paths.keys()
  const matches: Array<number> = []
  const best: Array<Scored> = []
  // No match is tighter than the letters side by side at the name's start.
  const floor = nameScore(letters.length - 1, 0)
  for (const at of candidates) {
    const lower = index.lower[at] ?? ""
    if (!hasLetters(lower, letters)) continue
    matches.push(at)
    const path = index.paths[at] ?? ""
    if (best.length === limit && beforeScore(floor, path, best[limit - 1]!) >= 0) continue
    const nameStart = index.nameStarts[at] ?? 0
    const nameMatch = tightest(lower.slice(nameStart), letters)
    const scored: Scored =
      nameMatch !== null
        ? { path, nameMatch, score: nameScore(spread(nameMatch), nameMatch[0] ?? 0) }
        : { path, nameMatch: null, score: PATH_MATCH + spread(tightest(lower, letters) ?? []) }
    if (best.length === limit && before(scored, best[limit - 1]!) >= 0) continue
    let place = best.length
    while (place > 0 && before(scored, best[place - 1]!) < 0) place--
    best.splice(place, 0, scored)
    if (best.length > limit) best.pop()
  }
  index.last = { letters, matches }
  return best.map(({ path, nameMatch }) => ({ path, nameMatch }))
}
