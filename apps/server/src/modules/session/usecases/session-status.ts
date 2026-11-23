import type { SessionStatus, WaitingFor } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export const setSessionStatus = (
  sessionId: string,
  status: SessionStatus,
  waitingFor: WaitingFor = null,
) =>
  Effect.gen(function* () {
    const at = yield* DateTime.now
    yield* (yield* SessionStore).setStatus(sessionId, status, at, waitingFor)
    yield* (yield* SessionFeed).publish(sessionId)
  })
