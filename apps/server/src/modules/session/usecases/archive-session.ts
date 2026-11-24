import { SessionNotFound } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"
import { SessionTabs } from "./session-tabs.ts"
import { WorktreeCleanup } from "./worktree-cleanup.ts"

export const archiveSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const at = yield* DateTime.now
    yield* (yield* SessionRuns).close(sessionId, store.setArchivedAt(sessionId, at))
    yield* (yield* SessionTabs).remove(sessionId)
    yield* (yield* SessionFeed).publish(sessionId)
    yield* (yield* WorktreeCleanup).afterTabsClosed(session.projectPath, [sessionId])
  })
