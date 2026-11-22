import { SessionNotFound, SessionTitleChosenByUser } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore, type TitleSource } from "./session-store.ts"

export const renameSession = (sessionId: string, title: string, by: TitleSource = "user") =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const feed = yield* SessionFeed
    const session = yield* store.findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const trimmed = title.trim()
    if (trimmed === "") return session
    if (!(yield* store.rename(sessionId, trimmed, by))) {
      return yield* new SessionTitleChosenByUser({ sessionId })
    }
    yield* feed.publish(sessionId)
    return (yield* store.findById(sessionId)) ?? (yield* new SessionNotFound({ sessionId }))
  })
