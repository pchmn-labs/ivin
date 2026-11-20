import { SessionNotFound, type WorkingFolderChoice } from "@ivin/contracts/session"
import { Effect } from "effect"
import { moveToCheckout, moveToExistingWorktree, moveToNewWorktree } from "./move-working-folder.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const pickWorkingFolder = (sessionId: string, workingFolder: WorkingFolderChoice) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    // An agent process keeps the cwd it started in.
    yield* (yield* SessionRuns).stop(sessionId)
    if (workingFolder.kind === "new_worktree") yield* moveToNewWorktree(session, "pick")
    else if (workingFolder.kind === "existing_worktree")
      yield* moveToExistingWorktree(session, workingFolder.path, "pick")
    else yield* moveToCheckout(session, "pick")
    yield* (yield* SessionFeed).publish(sessionId)
    return (yield* store.findById(sessionId)) ?? session
  })
