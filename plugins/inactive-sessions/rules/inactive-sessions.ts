export const inactiveSessions = <S extends { readonly id: string }>(
  sessions: ReadonlyArray<S>,
  tabs: ReadonlyArray<{ readonly sessionId: string }>,
): ReadonlyArray<S> => {
  const open = new Set(tabs.map((tab) => tab.sessionId))
  return sessions.filter((session) => !open.has(session.id))
}
