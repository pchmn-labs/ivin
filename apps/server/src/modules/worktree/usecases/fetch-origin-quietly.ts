import { Effect } from "effect"
import { WORKTREE_FETCH_REUSE_MS } from "../rules/fetch-reuse.ts"
import { Git } from "./git.ts"
import { OriginFetch } from "./origin-fetch.ts"

// Offline, the refs as last fetched still answer.
export const fetchOriginQuietly = (repo: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    if (!(yield* git.hasRemote(repo, "origin"))) return
    yield* (yield* OriginFetch).fetch(repo, {
      reuseMs: WORKTREE_FETCH_REUSE_MS,
      afterFailure: "wait",
    })
  }).pipe(Effect.catch((error) => Effect.logWarning(`could not fetch origin for ${repo}`, error)))
