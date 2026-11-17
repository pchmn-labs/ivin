const MAX_LINES = 10
const MAX_CHARS = 800
const PREVIEW_LINES = 3
const PREVIEW_CHARS = 200

export const foldText = (text: string): { folded: boolean; preview: string } => {
  const lines = text.split("\n")
  if (lines.length <= MAX_LINES && text.length <= MAX_CHARS) return { folded: false, preview: text }
  return { folded: true, preview: lines.slice(0, PREVIEW_LINES).join("\n").slice(0, PREVIEW_CHARS) }
}

export const formatInput = (input: unknown): string => JSON.stringify(input) ?? ""
