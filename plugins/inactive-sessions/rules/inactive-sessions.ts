export const inactiveSessions = <S extends { readonly id: string; readonly projectPath: string }>(
  sessions: ReadonlyArray<S>,
  tabs: ReadonlyArray<{ readonly sessionId: string }>,
  projectPath: string | null,
): ReadonlyArray<S> => {
  const open = new Set(tabs.map((tab) => tab.sessionId))
  return sessions.filter((session) => session.projectPath === projectPath && !open.has(session.id))
}
