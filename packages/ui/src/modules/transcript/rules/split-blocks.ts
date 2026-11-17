import { Lexer } from "marked"

export const splitBlocks = (text: string): ReadonlyArray<string> =>
  new Lexer()
    .lex(text)
    .filter((token) => token.type !== "space")
    .map((token) => token.raw)

// Streamed text only grows: finished blocks are kept and only the last one is lexed again.
export const extendBlocks = (
  previous: { readonly text: string; readonly blocks: ReadonlyArray<string> },
  text: string,
): ReadonlyArray<string> => {
  const last = previous.blocks.at(-1)
  if (last === undefined || !text.startsWith(previous.text)) return splitBlocks(text)
  const start = previous.text.lastIndexOf(last)
  if (start < 0 || !text.startsWith(previous.text.slice(0, start))) return splitBlocks(text)
  return [...previous.blocks.slice(0, -1), ...splitBlocks(text.slice(start))]
}
