import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { removeTargetAnnotations } from "../../annotation/usecases/remove-target-annotations.ts"
import { ImageStore } from "../../transcript/usecases/image-store.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"
import { SessionTabs } from "./session-tabs.ts"
import { WorktreeCleanup } from "./worktree-cleanup.ts"

export const deleteSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const { projectPath } = session
    const tabs = yield* SessionTabs
    // Before the delete, which erases the tab the next selection is read from.
    yield* (yield* SessionRuns).close(
      sessionId,
      tabs.remove(sessionId).pipe(Effect.andThen(store.delete(sessionId))),
    )
    yield* (yield* ImageStore).removeSession(sessionId)
    yield* removeTargetAnnotations({ _tag: "session", sessionId })
    yield* (yield* SessionFeed).publishRemoved(projectPath, sessionId)
    yield* (yield* WorktreeCleanup).afterTabsClosed(projectPath, [sessionId], [session])
  })
