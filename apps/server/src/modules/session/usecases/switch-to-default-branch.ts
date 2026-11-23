import {
  CheckoutHasLocalChanges,
  GitRefused,
  type LocalChangesChoice,
} from "@ivin/contracts/session"
import { Effect } from "effect"
import { defaultBranchName } from "../../worktree/rules/checkout-sync.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { newWorktreeBase } from "../../worktree/usecases/new-worktree-base.ts"
import { checkoutChange, refreshCheckoutBranch, stashAround } from "./checkout-change.ts"

export const switchToDefaultBranch = (sessionId: string, localChanges?: LocalChangesChoice) =>
  Effect.gen(function* () {
    const git = yield* Git
    const { session, checkout, refused } = yield* checkoutChange(sessionId)
    const branch = defaultBranchName(
      yield* newWorktreeBase(checkout).pipe(Effect.mapError(refused)),
    )
    if (branch === null) {
      return yield* new GitRefused({
        sessionId,
        message: "origin has no HEAD, origin/main or origin/master to switch to",
        blockedByLocalChanges: false,
      })
    }
    const switchTo = Effect.gen(function* () {
      const { local } = yield* git.listBranches(checkout)
      yield* local.includes(branch)
        ? git.checkout(checkout, branch)
        : git.checkoutTracking(checkout, `origin/${branch}`, branch)
      yield* git.fastForward(checkout, `origin/${branch}`)
    })
    // Stashed whenever asked: untracked files in the way are not counted as local changes.
    if (localChanges?.kind !== "stash") {
      if (yield* git.hasLocalChanges(checkout).pipe(Effect.mapError(refused))) {
        if (!localChanges) return yield* new CheckoutHasLocalChanges({ sessionId })
        yield* git.commitTracked(checkout, localChanges.message).pipe(Effect.mapError(refused))
      }
    }
    yield* (
      localChanges?.kind === "stash"
        ? stashAround(checkout, `WIP before switching to ${branch}`, switchTo)
        : switchTo
    ).pipe(
      Effect.mapError(refused),
      // A fast-forward refused after the checkout still leaves the session on the new branch.
      Effect.ensuring(refreshCheckoutBranch(session).pipe(Effect.ignore)),
    )
    return yield* refreshCheckoutBranch(session)
  })
