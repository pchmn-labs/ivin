import { SessionNotFound } from "@ivin/contracts/session"
import type { TabSubViews } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { TabStore } from "./tab-store.ts"

// Closes the sub-views opened in another working folder than the session's, then reads the rest.
export const pruneSubViews = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const store = yield* TabStore
    yield* store.removeSubViewsOutside(sessionId, session.workingFolder)
    return { session, store }
  })

export const readSubViews = (sessionId: string) =>
  Effect.gen(function* () {
    const stored = yield* (yield* TabStore).subViewsOf(sessionId)
    return {
      sessionId,
      subViews: stored.map((entry) => entry.subView),
      selected: stored.find((entry) => entry.selected)?.subView ?? null,
    } satisfies TabSubViews
  })
