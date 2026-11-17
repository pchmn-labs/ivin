import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export const renameSession = (sessionId: string, title: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const feed = yield* SessionFeed
    const trimmed = title.trim()
    if (trimmed !== "") {
      yield* store.rename(sessionId, trimmed)
      yield* feed.publish(sessionId)
    }
    const session = yield* store.findById(sessionId)
    return session ?? (yield* new SessionNotFound({ sessionId }))
  })
