import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { linkedWorktrees } from "../../worktree/rules/linked-worktrees.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export const checkWorkingFolder = (session: Session) =>
  Effect.gen(function* () {
    if (!session.inWorktree || session.workingFolderDeleted) return session
    const git = yield* Git
    const entries = yield* git.listWorktrees(session.projectPath).pipe(
      // The mark is only lifted by a pick, so a git failure must not set it.
      Effect.tapError((error) =>
        Effect.logWarning(`could not list the worktrees of ${session.projectPath}`, error),
      ),
      Effect.orElseSucceed(() => null),
    )
    if (!entries) return session
    if (linkedWorktrees(session.projectPath, entries).some((w) => w.path === session.workingFolder))
      return session
    yield* (yield* SessionStore).markWorkingFolderDeleted(session.id)
    yield* (yield* SessionFeed).publish(session.id)
    return { ...session, workingFolderDeleted: true }
  })
