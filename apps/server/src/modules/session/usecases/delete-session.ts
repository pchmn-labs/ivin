import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { removeTargetAnnotations } from "../../annotation/usecases/remove-target-annotations.ts"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { TabStore } from "../../tab/usecases/tab-store.ts"
import { ImageStore } from "../../transcript/usecases/image-store.ts"
import { WorktreeCleanup } from "../../worktree/usecases/worktree-cleanup.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const deleteSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const tabs = yield* TabStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const { projectPath } = session
    const order = (yield* tabs.listByProject(projectPath)).map((tab) => tab.sessionId)
    const selected = yield* tabs.selectedOf(projectPath)
    yield* (yield* SessionRuns).close(sessionId, store.delete(sessionId))
    yield* (yield* ImageStore).removeSession(sessionId)
    yield* removeTargetAnnotations({ _tag: "session", sessionId })
    if (selected === sessionId) {
      yield* tabs.select(projectPath, selectionAfterRemoval(order, sessionId))
    }
    yield* (yield* SessionFeed).publishRemoved(projectPath, sessionId)
    yield* (yield* WorktreeCleanup).afterTabsClosed(projectPath, [sessionId], [session])
  })
