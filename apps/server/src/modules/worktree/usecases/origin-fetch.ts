import { Clock, Context, Data, Effect, Layer } from "effect"
import { isFetchRecent } from "../rules/worktree-base.ts"
import { Git, type GitError } from "./git.ts"

const FETCH_TIMEOUT = "30 seconds"

export class FetchTimedOut extends Data.TaggedError("FetchTimedOut")<{}> {
  override get message() {
    return `git fetch origin did not finish within ${FETCH_TIMEOUT}`
  }
}

export class OriginFetch extends Context.Service<
  OriginFetch,
  {
    // Skipped when the repository's last successful fetch is younger than two minutes.
    readonly fetch: (repo: string) => Effect.Effect<void, GitError | FetchTimedOut>
  }
>()("ivin/server/OriginFetch") {}

export const layerOriginFetch = Layer.effect(OriginFetch)(
  Effect.gen(function* () {
    const git = yield* Git
    const lastFetchAt = new Map<string, number>()
    return {
      fetch: (repo) =>
        Effect.gen(function* () {
          if (isFetchRecent(lastFetchAt.get(repo), yield* Clock.currentTimeMillis)) return
          yield* git.fetch(repo, "origin").pipe(
            Effect.timeoutOrElse({
              duration: FETCH_TIMEOUT,
              orElse: () => Effect.fail(new FetchTimedOut()),
            }),
          )
          lastFetchAt.set(repo, yield* Clock.currentTimeMillis)
        }),
    }
  }),
)
