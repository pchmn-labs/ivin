import { SessionNotFound, SessionWorking, type WorkingFolderChoice } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { isBusy } from "../rules/busy-session.ts"
import { moveToCheckout, moveToExistingWorktree, moveToNewWorktree } from "./move-working-folder.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const pickWorkingFolder = (sessionId: string, workingFolder: WorkingFolderChoice) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    if (isBusy(session)) return yield* new SessionWorking({ sessionId })
    // An agent process keeps the cwd it started in.
    yield* (yield* SessionRuns).stop(sessionId)
    if (workingFolder.kind === "new_worktree") yield* moveToNewWorktree(session, "pick")
    else if (workingFolder.kind === "existing_worktree")
      yield* moveToExistingWorktree(session, workingFolder.path, "pick")
    else yield* moveToCheckout(session, "pick")
    // No run follows the pick to end the "preparing worktree" status a new worktree set.
    yield* store.setStatus(sessionId, "idle", yield* DateTime.now)
    yield* (yield* SessionFeed).publish(sessionId)
    return (yield* store.findById(sessionId)) ?? session
  })
