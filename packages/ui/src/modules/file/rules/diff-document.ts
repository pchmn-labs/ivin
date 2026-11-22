import type { DiffHunk } from "@ivin/contracts/file"

export const diffDocument = (hunks: ReadonlyArray<DiffHunk>) => {
  const texts: string[] = []
  const rows: DiffHunk["lines"][number][] = []
  const starts: { start: number; header: string }[] = []
  for (const hunk of hunks) {
    starts.push({ start: rows.length, header: hunk.header })
    for (const line of hunk.lines) {
      texts.push(line.text)
      rows.push(line)
    }
  }
  return { text: texts.join("\n"), layout: { rows, hunks: starts } }
}
