import { SessionNotFound } from "@ivin/contracts/session"
import type { TabSubViews } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { TabStore } from "./tab-store.ts"

// Returns the session, whose working folder the remaining sub-views were opened in.
export const closeSubViewsOfOtherFolders = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    yield* (yield* TabStore).removeSubViewsOutside(sessionId, session.workingFolder)
    return session
  })

export const tabSubViews = (sessionId: string) =>
  Effect.gen(function* () {
    const stored = yield* (yield* TabStore).subViewsOf(sessionId)
    return {
      sessionId,
      subViews: stored.map((entry) => entry.subView),
      selected: stored.find((entry) => entry.selected)?.subView ?? null,
    } satisfies TabSubViews
  })
