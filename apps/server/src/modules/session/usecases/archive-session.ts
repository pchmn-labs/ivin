import { SessionNotFound } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { removeTab } from "../../tab/usecases/remove-tab.ts"
import { WorktreeCleanup } from "../../worktree/usecases/worktree-cleanup.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const archiveSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    yield* (yield* SessionRuns).stop(sessionId)
    yield* store.setArchivedAt(sessionId, yield* DateTime.now)
    yield* removeTab(sessionId)
    yield* (yield* SessionFeed).publish(sessionId)
    yield* (yield* WorktreeCleanup).afterTabsClosed(session.projectPath, [sessionId])
  })
