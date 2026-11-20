import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { linkedWorktrees } from "../../worktree/rules/linked-worktrees.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

const toCheck = (session: Session) => session.inWorktree && !session.workingFolderDeleted

// Sessions of one project, so one `git worktree list` answers for all of them.
export const checkWorkingFolders = (projectPath: string, sessions: readonly Session[]) =>
  Effect.gen(function* () {
    const checked = sessions.filter(toCheck)
    if (checked.length === 0) return new Set<string>()
    const entries = yield* (yield* Git).listWorktrees(projectPath).pipe(
      // The mark is only lifted by a pick, so a git failure must not set it.
      Effect.tapError((error) =>
        Effect.logWarning(`could not list the worktrees of ${projectPath}`, error),
      ),
      Effect.orElseSucceed(() => null),
    )
    if (!entries) return new Set<string>()
    const listed = new Set(linkedWorktrees(projectPath, entries).map((w) => w.path))
    const deleted = checked.filter((session) => !listed.has(session.workingFolder))
    const store = yield* SessionStore
    const feed = yield* SessionFeed
    for (const session of deleted) {
      yield* store.markWorkingFolderDeleted(session.id)
      yield* feed.publish(session.id)
    }
    return new Set(deleted.map((session) => session.id))
  })

export const checkWorkingFolder = (session: Session) =>
  checkWorkingFolders(session.projectPath, [session]).pipe(
    Effect.map((deleted) =>
      deleted.has(session.id) ? { ...session, workingFolderDeleted: true } : session,
    ),
  )
