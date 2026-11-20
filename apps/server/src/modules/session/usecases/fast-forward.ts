import { GitRefused } from "@ivin/contracts/session"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { checkoutChange, refreshCheckoutBranch } from "./checkout-change.ts"

export const fastForward = (sessionId: string, stash = false) =>
  Effect.gen(function* () {
    const git = yield* Git
    const { session, checkout, refused } = yield* checkoutChange(sessionId)
    const branch = yield* git.currentBranch(checkout)
    if (branch === null) {
      return yield* new GitRefused({
        sessionId,
        message: "HEAD is detached: there is no branch to fast-forward",
        blockedByLocalChanges: false,
      })
    }
    if (stash) yield* git.stash(checkout, "WIP before pulling").pipe(Effect.mapError(refused))
    yield* git.fastForward(checkout, `origin/${branch}`).pipe(Effect.mapError(refused))
    return yield* refreshCheckoutBranch(session)
  })
