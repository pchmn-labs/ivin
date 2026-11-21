import type { SettingsFileInvalid } from "@ivin/contracts/setting"
import {
  applyEdits,
  findNodeAtLocation,
  format,
  type FormattingOptions,
  modify,
  parseTree,
  type ParseError,
  printParseErrorCode,
} from "jsonc-parser"

type Refusal = Pick<SettingsFileInvalid, "reason" | "parseError">

const indentOf = (text: string): Pick<FormattingOptions, "insertSpaces" | "tabSize"> => {
  const indent = /^[ \t]+(?=\S)/m.exec(text)?.[0]
  if (indent === undefined) return { insertSpaces: true, tabSize: 2 }
  return indent.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1 }
    : { insertSpaces: true, tabSize: indent.length }
}

const lineAndColumn = (text: string, offset: number) => {
  const before = text.slice(0, offset).split("\n")
  return { line: before.length, column: before.at(-1)!.length + 1 }
}

const nestedObject = (keys: readonly string[], value: unknown): unknown =>
  keys.reduceRight((inner, key) => ({ [key]: inner }), value)

// Edits the value in place, so the rest of the file stays byte for byte as it was.
export const editSettingsText = (
  original: string | null,
  path: string,
  value: unknown,
): { readonly ok: true; readonly text: string } | ({ readonly ok: false } & Refusal) => {
  if (original === null || original.trim() === "") {
    return { ok: true, text: `${JSON.stringify(nestedObject(path.split("."), value), null, 2)}\n` }
  }
  const text = original
  const errors: ParseError[] = []
  const root = parseTree(text, errors, { allowTrailingComma: true })
  const [error] = errors
  if (error !== undefined) {
    return {
      ok: false,
      reason: "notJson",
      parseError: { code: printParseErrorCode(error.error), ...lineAndColumn(text, error.offset) },
    }
  }
  if (root?.type !== "object") return { ok: false, reason: "notAnObject", parseError: null }

  const keys = path.split(".")
  // A section that holds something else than an object is replaced by one with the value.
  const blocked = keys.findIndex((_, index) => {
    const node = findNodeAtLocation(root, keys.slice(0, index + 1))
    return index < keys.length - 1 && node !== undefined && node.type !== "object"
  })
  const [at, set] =
    blocked === -1
      ? [keys, value]
      : [keys.slice(0, blocked + 1), nestedObject(keys.slice(blocked + 1), value)]
  return { ok: true, text: withEdit(text, at, set) }
}

// jsonc-parser's own formatting would also reformat the line the edit starts on.
const withEdit = (text: string, at: readonly string[], value: unknown) => {
  const [edit] = modify(text, [...at], value, {})
  if (edit === undefined) return text
  const edited = applyEdits(text, [edit])
  const start = edit.offset
  const end = start + edit.content.length
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const formatting = format(
    edited,
    { offset: start, length: end - start },
    { ...indentOf(text), eol, keepLines: false },
  ).filter(({ offset, length }) => offset >= start && offset + length <= end)
  return applyEdits(edited, formatting)
}
