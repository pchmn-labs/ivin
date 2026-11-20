import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { checkWorkingFolders } from "../../session/usecases/check-working-folder.ts"
import { SessionRuns } from "../../session/usecases/session-runs.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { TabStore } from "../../tab/usecases/tab-store.ts"
import { isInUse, isRemovable, removalCandidates } from "../rules/worktree-removal.ts"
import { Git } from "./git.ts"
import { listWorktrees } from "./list-worktrees.ts"
import { newWorktreeBase } from "./new-worktree-base.ts"
import { OriginFetch } from "./origin-fetch.ts"

// Run once the closed sessions' agents have stopped: a running agent keeps its worktree.
// `deletedSessions` are gone from the store, yet their worktrees count as just closed.
export const removeMergedWorktrees = (
  projectPath: string,
  closedSessionIds: readonly string[],
  deletedSessions: readonly Session[] = [],
) =>
  Effect.gen(function* () {
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
      const tabs = yield* (yield* TabStore).listByProject(projectPath)
      const open = new Set(tabs.map((tab) => tab.sessionId))
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
    const candidates = removalCandidates(projectPath, yield* listWorktrees(projectPath), sessions)

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
