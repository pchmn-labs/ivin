import { type RunOptions, SessionNotFound } from "@ivin/contracts/session"
import { HarnessProvider } from "@ivin/harness"
import { DateTime, Effect } from "effect"
import { runOptionChanges, runOptionsOf } from "../rules/run-options.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const setRunOptions = (sessionId: string, requested: Partial<RunOptions>) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const feed = yield* SessionFeed
    const found = yield* store.findById(sessionId)
    if (!found) return yield* new SessionNotFound({ sessionId })
    const changes = runOptionChanges(found, requested, yield* (yield* HarnessProvider).runOptions)
    if (changes.length > 0) {
      yield* store.setRunOptions(
        sessionId,
        { ...runOptionsOf(found), ...requested },
        yield* DateTime.now,
      )
    }
    if (found.relaunchFailure !== null) yield* store.setRelaunchFailure(sessionId, null)
    const session = (yield* store.findById(sessionId)) ?? found
    if (found.started) {
      yield* Effect.forEach(changes, (change) =>
        runs.record(session, { type: "run_option", ...change, raw: null }),
      )
    }
    yield* feed.publish(sessionId)
    return session
  })
