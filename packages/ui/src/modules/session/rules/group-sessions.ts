import type { SessionStatus } from "@ivin/contracts/session"

// Keeps the order it is given: the list is already newest activity first.
export const groupSessions = <S extends { readonly status: SessionStatus }>(
  sessions: ReadonlyArray<S>,
) => ({
  needsYou: sessions.filter((s) => s.status === "waiting"),
  others: sessions.filter((s) => s.status !== "waiting"),
})
