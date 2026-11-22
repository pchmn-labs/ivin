import type { DiffHunk, DiffLine } from "@ivin/contracts/file"

export type ParsedDiff =
  | {
      readonly kind: "text"
      readonly hunks: ReadonlyArray<DiffHunk>
      readonly added: number
      readonly deleted: number
    }
  | { readonly kind: "binary" }

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

// The middle of `line` that differs from `other`, null when the two share nothing at their ends.
const changedPart = (line: string, other: string): readonly [number, number] | null => {
  let start = 0
  while (start < line.length && start < other.length && line[start] === other[start]) start++
  let end = 0
  while (
    end < line.length - start &&
    end < other.length - start &&
    line[line.length - 1 - end] === other[other.length - 1 - end]
  )
    end++
  if (start + end === 0 || start === line.length - end) return null
  return [start, line.length - end]
}

const markChangedParts = (lines: DiffLine[]) => {
  for (let index = 0; index < lines.length;) {
    if (lines[index]!.kind !== "deleted") {
      index++
      continue
    }
    const deletedStart = index
    while (lines[index]?.kind === "deleted") index++
    const addedStart = index
    while (lines[index]?.kind === "added") index++
    const pairs = Math.min(addedStart - deletedStart, index - addedStart)
    for (let pair = 0; pair < pairs; pair++) {
      const deleted = lines[deletedStart + pair]!
      const added = lines[addedStart + pair]!
      lines[deletedStart + pair] = { ...deleted, changed: changedPart(deleted.text, added.text) }
      lines[addedStart + pair] = { ...added, changed: changedPart(added.text, deleted.text) }
    }
  }
}

// `output` is the unified diff of one file, as `git diff` writes it.
export const parseDiff = (output: string): ParsedDiff => {
  const hunks: { header: string; lines: DiffLine[] }[] = []
  let oldLine = 0
  let newLine = 0
  let added = 0
  let deleted = 0
  for (const raw of output.split("\n")) {
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw
    const header = HUNK_HEADER.exec(text)
    if (header !== null) {
      hunks.push({ header: header[0], lines: [] })
      oldLine = Number(header[1])
      newLine = Number(header[2])
      continue
    }
    const hunk = hunks.at(-1)
    if (hunk === undefined) {
      if (text.startsWith("Binary files ") || text === "GIT binary patch") return { kind: "binary" }
      continue
    }
    const sign = text.charAt(0)
    const body = text.slice(1)
    if (sign === "+") {
      added++
      hunk.lines.push({
        kind: "added",
        text: body,
        oldLine: null,
        newLine: newLine++,
        changed: null,
      })
    } else if (sign === "-") {
      deleted++
      hunk.lines.push({
        kind: "deleted",
        text: body,
        oldLine: oldLine++,
        newLine: null,
        changed: null,
      })
    } else if (sign === " ") {
      hunk.lines.push({
        kind: "context",
        text: body,
        oldLine: oldLine++,
        newLine: newLine++,
        changed: null,
      })
    }
  }
  for (const hunk of hunks) markChangedParts(hunk.lines)
  return { kind: "text", hunks, added, deleted }
}
