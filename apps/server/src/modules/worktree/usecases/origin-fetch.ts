import { Clock, Context, Data, Effect, Layer, Semaphore } from "effect"
import { isFetchRecent } from "../rules/fetch-reuse.ts"
import { Git, type GitError } from "./git.ts"

const FETCH_TIMEOUT = "30 seconds"

export class FetchTimedOut extends Data.TaggedError("FetchTimedOut")<{}> {
  override get message() {
    return `git fetch origin did not finish within ${FETCH_TIMEOUT}`
  }
}

export interface FetchReuse {
  readonly reuseMs: number
  // A worktree must start from fresh refs, so it retries; a listing waits rather than retry offline.
  readonly afterFailure: "retry" | "wait"
}

export class OriginFetch extends Context.Service<
  OriginFetch,
  {
    // No-op when the last fetch of `repo` is younger than `reuseMs`; one fetch per repo at a time.
    readonly fetch: (
      repo: string,
      reuse: FetchReuse,
    ) => Effect.Effect<void, GitError | FetchTimedOut>
  }
>()("ivin/server/OriginFetch") {}

export const layerOriginFetch = Layer.effect(OriginFetch)(
  Effect.gen(function* () {
    const git = yield* Git
    const lastSuccessAt = new Map<string, number>()
    const lastAttemptAt = new Map<string, number>()
    const locks = new Map<string, Semaphore.Semaphore>()
    const lockOf = (repo: string) => {
      let lock = locks.get(repo)
      if (!lock) locks.set(repo, (lock = Semaphore.makeUnsafe(1)))
      return lock
    }
    return {
      fetch: (repo, { reuseMs, afterFailure }) =>
        lockOf(repo).withPermits(1)(
          Effect.gen(function* () {
            const last = (afterFailure === "wait" ? lastAttemptAt : lastSuccessAt).get(repo)
            if (isFetchRecent(last, yield* Clock.currentTimeMillis, reuseMs)) return
            lastAttemptAt.set(repo, yield* Clock.currentTimeMillis)
            yield* git.fetch(repo, "origin").pipe(
              Effect.timeoutOrElse({
                duration: FETCH_TIMEOUT,
                orElse: () => Effect.fail(new FetchTimedOut()),
              }),
            )
            lastSuccessAt.set(repo, yield* Clock.currentTimeMillis)
          }),
        ),
    }
  }),
)
