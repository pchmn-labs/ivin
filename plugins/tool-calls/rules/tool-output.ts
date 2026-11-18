const MAX_LINES = 10
const MAX_CHARS = 800
const PREVIEW_LINES = 3
const PREVIEW_CHARS = 200

export const foldText = (text: string): { folded: boolean; preview: string } => {
  const lines = text.split("\n")
  if (lines.length <= MAX_LINES && text.length <= MAX_CHARS) return { folded: false, preview: text }
  return { folded: true, preview: lines.slice(0, PREVIEW_LINES).join("\n").slice(0, PREVIEW_CHARS) }
}

const MAIN_ARGUMENT: Readonly<Record<string, string>> = {
  Bash: "command",
  Edit: "file_path",
  Write: "file_path",
  Read: "file_path",
  MultiEdit: "file_path",
  Grep: "pattern",
  Glob: "pattern",
  WebFetch: "url",
  Task: "description",
}

export const mainArgument = (name: string, input: unknown): string | null => {
  const key = MAIN_ARGUMENT[name]
  if (key === undefined || typeof input !== "object" || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === "string" ? value : null
}

export const prettyInput = (input: unknown): string => JSON.stringify(input, null, 2) ?? ""
