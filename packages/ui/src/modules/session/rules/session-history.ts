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

export const canGoBack = (history: SessionHistory) => history.index > 0

export const canGoForward = (history: SessionHistory) => history.index < history.entries.length - 1

export const goBack = (history: SessionHistory): SessionHistory =>
  canGoBack(history) ? { ...history, index: history.index - 1 } : history

export const goForward = (history: SessionHistory): SessionHistory =>
  canGoForward(history) ? { ...history, index: history.index + 1 } : history
