import type { PluginFileChange } from "@ivin/contracts/plugin"

// `text` is null for a binary file; `digest` tells two versions of a file apart.
export interface TreeFile {
  readonly text: string | null
  readonly digest: string
}
export type PluginTree = ReadonlyMap<string, TreeFile>

const CONTEXT = 3
// Above this many line pairs a file is shown as replaced whole, not compared line by line.
const MAX_COMPARED_PAIRS = 4_000_000

export const changedFiles = (
  trusted: PluginTree | null,
  disk: PluginTree,
): ReadonlyArray<PluginFileChange> => {
  const changes: PluginFileChange[] = []
  for (const path of new Set([...(trusted?.keys() ?? []), ...disk.keys()])) {
    const before = trusted?.get(path)
    const after = disk.get(path)
    if (after === undefined) changes.push({ path, status: "D" })
    else if (before === undefined) changes.push({ path, status: "A" })
    else if (before.digest !== after.digest) changes.push({ path, status: "M" })
  }
  return changes.toSorted((a, b) => (a.path < b.path ? -1 : 1))
}

const linesOf = (text: string) => {
  if (text === "") return []
  const lines = text.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

type Edit = { readonly kind: " " | "-" | "+"; readonly line: string }

const editsOf = (before: string[], after: string[]): Edit[] => {
  if (before.length * after.length > MAX_COMPARED_PAIRS) {
    return [
      ...before.map((line): Edit => ({ kind: "-", line })),
      ...after.map((line): Edit => ({ kind: "+", line })),
    ]
  }
  // lengths[i][j]: the longest common run of before[i..] and after[j..].
  const lengths = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0),
  )
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i]![j] =
        before[i] === after[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }
  const edits: Edit[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      edits.push({ kind: " ", line: before[i]! })
      i++
      j++
    } else if (
      j >= after.length ||
      (i < before.length && lengths[i + 1]![j]! >= lengths[i]![j + 1]!)
    ) {
      edits.push({ kind: "-", line: before[i]! })
      i++
    } else {
      edits.push({ kind: "+", line: after[j]! })
      j++
    }
  }
  return edits
}

const hunksOf = (edits: Edit[]): string[] => {
  const changedAt = edits.flatMap((edit, index) => (edit.kind === " " ? [] : [index]))
  const out: string[] = []
  let start = 0
  while (start < changedAt.length) {
    let end = start
    while (end + 1 < changedAt.length && changedAt[end + 1]! - changedAt[end]! <= 2 * CONTEXT) end++
    const from = Math.max(0, changedAt[start]! - CONTEXT)
    const to = Math.min(edits.length, changedAt[end]! + CONTEXT + 1)
    const slice = edits.slice(from, to)
    const before = edits.slice(0, from).filter((edit) => edit.kind !== "+").length
    const after = edits.slice(0, from).filter((edit) => edit.kind !== "-").length
    const oldCount = slice.filter((edit) => edit.kind !== "+").length
    const newCount = slice.filter((edit) => edit.kind !== "-").length
    out.push(
      `@@ -${oldCount === 0 ? before : before + 1},${oldCount} +${newCount === 0 ? after : after + 1},${newCount} @@`,
      ...slice.map((edit) => `${edit.kind}${edit.line}`),
    )
    start = end + 1
  }
  return out
}

// Unified diff of the text files changed against the trusted version; empty for a plugin never trusted.
export const unifiedDiff = (trusted: PluginTree | null, disk: PluginTree): string => {
  if (trusted === null) return ""
  const out: string[] = []
  for (const { path, status } of changedFiles(trusted, disk)) {
    const before = trusted.get(path)
    const after = disk.get(path)
    if (before?.text === null || after?.text === null) {
      out.push(`Binary file ${path} differs`)
      continue
    }
    out.push(
      status === "A" ? "--- /dev/null" : `--- a/${path}`,
      status === "D" ? "+++ /dev/null" : `+++ b/${path}`,
      ...hunksOf(editsOf(linesOf(before?.text ?? ""), linesOf(after?.text ?? ""))),
    )
  }
  return out.length === 0 ? "" : `${out.join("\n")}\n`
}
