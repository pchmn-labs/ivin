// JSON with comments and trailing commas, as the files of ~/.ivin are written.
export const parseJsonc = (
  text: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  try {
    return { ok: true, value: JSON.parse(withoutTrailingCommas(withoutComments(text))) }
  } catch {
    return { ok: false }
  }
}

const withoutComments = (text: string) => {
  let out = ""
  let i = 0
  while (i < text.length) {
    const char = text[i]!
    if (char === '"') {
      const end = endOfString(text, i)
      out += text.slice(i, end)
      i = end
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i)
      i = end === -1 ? text.length : end
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2)
      // An unclosed comment is left in place so JSON.parse rejects it.
      if (end === -1) return out + text.slice(i)
      out += " "
      i = end + 2
    } else {
      out += char
      i++
    }
  }
  return out
}

const withoutTrailingCommas = (text: string) => {
  let out = ""
  let i = 0
  while (i < text.length) {
    const char = text[i]!
    if (char === '"') {
      const end = endOfString(text, i)
      out += text.slice(i, end)
      i = end
      continue
    }
    if (char === ",") {
      const next = text.slice(i + 1).trimStart()[0]
      if (next === "]" || next === "}") {
        i++
        continue
      }
    }
    out += char
    i++
  }
  return out
}

const endOfString = (text: string, start: number) => {
  let i = start + 1
  while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1
  return Math.min(i + 1, text.length)
}
