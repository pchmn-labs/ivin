export interface SessionHistory {
  readonly entries: ReadonlyArray<string>
  readonly index: number
}

export const emptyHistory: SessionHistory = { entries: [], index: -1 }

export const currentOf = (history: SessionHistory): string | null =>
  history.entries[history.index] ?? null

// Opening a session drops the entries ahead of the current one, as a browser does.
export const visit = (history: SessionHistory, sessionId: string): SessionHistory => {
  if (currentOf(history) === sessionId) return history
  const entries = [...history.entries.slice(0, history.index + 1), sessionId]
  return { entries, index: entries.length - 1 }
}

const nextIndex = (history: SessionHistory, step: 1 | -1, exists: (id: string) => boolean) => {
  for (let i = history.index + step; i >= 0 && i < history.entries.length; i += step) {
    if (exists(history.entries[i]!)) return i
  }
  return null
}

const always = (_id: string) => true

export const canGoBack = (history: SessionHistory, exists = always) =>
  nextIndex(history, -1, exists) !== null

export const canGoForward = (history: SessionHistory, exists = always) =>
  nextIndex(history, 1, exists) !== null

export const goBack = (history: SessionHistory, exists = always): SessionHistory => {
  const index = nextIndex(history, -1, exists)
  return index === null ? history : { ...history, index }
}

export const goForward = (history: SessionHistory, exists = always): SessionHistory => {
  const index = nextIndex(history, 1, exists)
  return index === null ? history : { ...history, index }
}
