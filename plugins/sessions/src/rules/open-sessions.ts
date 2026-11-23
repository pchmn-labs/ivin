export const openSessions = <S extends { readonly id: string }>(
  sessions: ReadonlyArray<S>,
  tabs: ReadonlyArray<{ readonly sessionId: string }>,
): ReadonlyArray<S> => {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  return tabs.flatMap((tab) => byId.get(tab.sessionId) ?? [])
}
