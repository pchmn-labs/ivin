import type { Session } from "@ivin/contracts/session"
import { Context, Effect, FiberSet, Layer, Semaphore } from "effect"
import { logFailure } from "../../log/usecases/log-error.ts"
import { SessionFeed } from "../../session/usecases/session-feed.ts"
import { SessionRuns } from "../../session/usecases/session-runs.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { TabStore } from "../../tab/usecases/tab-store.ts"
import { Git } from "./git.ts"
import { OriginFetch } from "./origin-fetch.ts"
import { removeMergedWorktrees } from "./remove-merged-worktrees.ts"

export class WorktreeCleanup extends Context.Service<
  WorktreeCleanup,
  {
    // Returns at once: a fetch of origin must not hold the tab's closing.
    readonly afterTabsClosed: (
      projectPath: string,
      sessionIds: readonly string[],
      deletedSessions?: readonly Session[],
    ) => Effect.Effect<void>
    // Waits for the cleanups started so far.
    readonly settled: Effect.Effect<void>
  }
>()("ivin/server/WorktreeCleanup") {}

export const layerWorktreeCleanup = Layer.effect(WorktreeCleanup)(
  Effect.gen(function* () {
    const context = yield* Effect.context<
      CurrentSettings | Git | OriginFetch | SessionFeed | SessionRuns | SessionStore | TabStore
    >()
    const fibers = yield* FiberSet.make()
    // One pass at a time, so two never judge the same worktree.
    const passes = yield* Semaphore.make(1)
    return {
      afterTabsClosed: (projectPath, sessionIds, deletedSessions = []) =>
        FiberSet.run(
          fibers,
          passes
            .withPermits(1)(removeMergedWorktrees(projectPath, sessionIds, deletedSessions))
            .pipe(
              Effect.catchCause((cause) => logFailure("worktree cleanup", cause)),
              Effect.provideContext(context),
            ),
        ).pipe(Effect.asVoid),
      settled: FiberSet.awaitEmpty(fibers),
    }
  }),
)
