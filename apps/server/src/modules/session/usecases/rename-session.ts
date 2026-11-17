import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const renameSession = (sessionId: string, title: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const trimmed = title.trim()
    if (trimmed !== "") yield* store.rename(sessionId, trimmed)
    const session = yield* store.findById(sessionId)
    return session ?? (yield* new SessionNotFound({ sessionId }))
  })
