import {
  CheckoutHasLocalChanges,
  GitRefused,
  type LocalChangesChoice,
} from "@ivin/contracts/session"
import { Effect } from "effect"
import { defaultBranchName } from "../../worktree/rules/checkout-sync.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { newWorktreeBase } from "../../worktree/usecases/new-worktree-base.ts"
import { checkoutChange, refreshCheckoutBranch } from "./checkout-change.ts"

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
    // Stashed whenever asked: untracked files in the way are not counted as local changes.
    if (localChanges?.kind === "stash") {
      yield* git.stash(checkout, `WIP before switching to ${branch}`).pipe(Effect.mapError(refused))
    } else if (yield* git.hasLocalChanges(checkout).pipe(Effect.mapError(refused))) {
      if (!localChanges) return yield* new CheckoutHasLocalChanges({ sessionId })
      yield* git.commitTracked(checkout, localChanges.message).pipe(Effect.mapError(refused))
    }
    yield* git.checkout(checkout, branch).pipe(
      Effect.andThen(git.fastForward(checkout, `origin/${branch}`)),
      Effect.mapError(refused),
      // A fast-forward refused after the checkout still leaves the session on the new branch.
      Effect.ensuring(refreshCheckoutBranch(session).pipe(Effect.ignore)),
    )
    return yield* refreshCheckoutBranch(session)
  })
