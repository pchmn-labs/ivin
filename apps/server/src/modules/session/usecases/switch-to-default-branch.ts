import {
  CheckoutHasLocalChanges,
  type Session,
  GitRefused,
  type LocalChangesChoice,
} from "@ivin/contracts/session"
import { Effect } from "effect"
import { defaultBranchName, isBlockedByLocalChanges } from "../../worktree/rules/checkout-sync.ts"
import { fetchOriginQuietly } from "../../worktree/usecases/checkout-status.ts"
import { Git, type GitError } from "../../worktree/usecases/git.ts"
import { newWorktreeBase } from "../../worktree/usecases/new-worktree-base.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"
import { unstartedSession } from "./unstarted-session.ts"

export const gitRefused = (sessionId: string) => (error: GitError) =>
  new GitRefused({
    sessionId,
    message: error.message,
    blockedByLocalChanges: isBlockedByLocalChanges(error.message),
  })

export const refreshCheckoutBranch = (session: Session) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const checkout = session.projectPath
    yield* store.setWorkingFolder(session.id, checkout, yield* (yield* Git).currentBranch(checkout))
    yield* (yield* SessionFeed).publish(session.id)
    return (yield* store.findById(session.id)) ?? session
  })

export const switchToDefaultBranch = (sessionId: string, localChanges?: LocalChangesChoice) =>
  Effect.gen(function* () {
    const git = yield* Git
    const session = yield* unstartedSession(sessionId)
    const checkout = session.projectPath
    const refused = gitRefused(sessionId)
    yield* fetchOriginQuietly(checkout)
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
    if (yield* git.hasLocalChanges(checkout).pipe(Effect.mapError(refused))) {
      if (!localChanges) return yield* new CheckoutHasLocalChanges({ sessionId })
      yield* (
        localChanges.kind === "stash"
          ? git.stash(checkout, `WIP before switching to ${branch}`)
          : git.commitAll(checkout, localChanges.message)
      ).pipe(Effect.mapError(refused))
    }
    yield* git.checkout(checkout, branch).pipe(
      Effect.andThen(git.fastForward(checkout, `origin/${branch}`)),
      Effect.mapError(refused),
      // A fast-forward refused after the checkout still leaves the session on the new branch.
      Effect.ensuring(refreshCheckoutBranch(session).pipe(Effect.ignore)),
    )
    return yield* refreshCheckoutBranch(session)
  })
