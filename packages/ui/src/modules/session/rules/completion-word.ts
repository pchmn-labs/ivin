export interface CompletionWord {
  readonly start: number
  readonly end: number
  readonly query: string
}

// The word the caret is in, when it starts with `trigger` and the caret is past the trigger.
export const completionWord = (
  text: string,
  caret: number | null,
  trigger: string,
  atStart: boolean,
): CompletionWord | null => {
  if (caret === null) return null
  const start = text.slice(0, caret).search(/\S*$/)
  if (atStart && start !== 0) return null
  if (!text.startsWith(trigger, start) || caret < start + trigger.length) return null
  const end = caret + (/^\S*/.exec(text.slice(caret))?.[0].length ?? 0)
  return { start, end, query: text.slice(start + trigger.length, end) }
}

// Escape closes the sheet on this word until it changes.
export const wordKey = (start: number, word: string) => `${start}:${word}`

export const pickedText = (word: CompletionWord, trigger: string, label: string, text: string) =>
  `${trigger}${label}${/^\s/.test(text.slice(word.end)) ? "" : " "}`
