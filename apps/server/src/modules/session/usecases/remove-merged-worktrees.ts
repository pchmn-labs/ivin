import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { isInUse, isRemovable, removalCandidates } from "../../worktree/rules/worktree-removal.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { listWorktreesOrNone } from "../../worktree/usecases/list-worktrees.ts"
import { newWorktreeBase } from "../../worktree/usecases/new-worktree-base.ts"
import { OriginFetch } from "../../worktree/usecases/origin-fetch.ts"
import { checkWorkingFolders } from "./check-working-folder.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"
import { SessionTabs } from "./session-tabs.ts"

// Run once the closed sessions' agents have stopped: a running agent keeps its worktree.
// `deletedSessions` are gone from the store, yet their worktrees count as just closed.
export const removeMergedWorktrees = (
  projectPath: string,
  closedSessionIds: readonly string[],
  deletedSessions: readonly Session[] = [],
) =>
  Effect.gen(function* () {
    // The worktrees of a workspace session are not cleaned up yet.
    if (isWorkspaceFile(projectPath)) return
    const { worktrees } = yield* (yield* CurrentSettings).get
    if (!worktrees.removeOnTabClose) return
    const git = yield* Git
    if (!(yield* git.hasRemote(projectPath, "origin"))) return
    // A pull request merged since the last fetch must count as merged.
    yield* (yield* OriginFetch)
      .fetch(projectPath, { reuseMs: 0, afterFailure: "retry" })
      .pipe(Effect.catch((error) => Effect.logWarning(`could not fetch ${projectPath}`, error)))
    const target = yield* newWorktreeBase(projectPath)
    if (target === null) return

    const sessionUses = Effect.gen(function* () {
      const sessions = [
        ...(yield* (yield* SessionStore).listByProject(projectPath)),
        ...deletedSessions,
      ]
      const open = new Set(yield* (yield* SessionTabs).openSessionIds(projectPath))
      const runs = yield* SessionRuns
      const closed = new Set(closedSessionIds)
      return yield* Effect.forEach(sessions, (session) =>
        runs.isRunning(session.id).pipe(
          Effect.map((running) => ({
            ...session,
            tabJustClosed: closed.has(session.id),
            inUse: running || open.has(session.id),
          })),
        ),
      )
    })
    const sessions = yield* sessionUses
    const candidates = removalCandidates(
      projectPath,
      yield* listWorktreesOrNone(projectPath),
      sessions,
    )

    yield* Effect.forEach(candidates, ({ path, origin }) =>
      Effect.gen(function* () {
        const clean = yield* git.isClean(path)
        const state = { clean, ...(yield* git.isMergedInto(path, target)) }
        if (!isRemovable(origin, state)) return
        // A tab may have reopened, or an agent started, while git answered.
        if (isInUse(path, yield* sessionUses)) return
        yield* git.removeWorktree(projectPath, path)
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`could not clean up the worktree ${path}`, error),
        ),
      ),
    )
    const deleted = new Set(deletedSessions.map((session) => session.id))
    yield* checkWorkingFolders(
      projectPath,
      sessions.filter((session) => !deleted.has(session.id)),
    )
  })
