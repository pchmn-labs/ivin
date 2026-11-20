import {
  CheckoutInUse,
  GitRefused,
  type Session,
  SessionAlreadyStarted,
  SessionNotFound,
} from "@ivin/contracts/session"
import { Effect } from "effect"
import { isBlockedByLocalChanges } from "../../worktree/rules/checkout-sync.ts"
import { fetchOriginQuietly } from "../../worktree/usecases/fetch-origin-quietly.ts"
import { Git, type GitError } from "../../worktree/usecases/git.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

const inCheckout = (session: Session) => !session.inWorktree

// The checkout of an unstarted session, once origin is fetched, unless another agent works there.
export const checkoutChange = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    if (session.started) return yield* new SessionAlreadyStarted({ sessionId })
    const busy = (yield* store.listByProject(session.projectPath)).some(
      (other) =>
        other.id !== sessionId &&
        inCheckout(other) &&
        (other.status === "working" || other.status === "waiting"),
    )
    if (busy) return yield* new CheckoutInUse({ sessionId })
    yield* fetchOriginQuietly(session.projectPath)
    return {
      session,
      checkout: session.projectPath,
      refused: (error: GitError) =>
        new GitRefused({
          sessionId,
          message: error.message,
          blockedByLocalChanges: isBlockedByLocalChanges(error.message),
        }),
    }
  })

// Every session in the checkout shows its branch, not only the one that moved it.
export const refreshCheckoutBranch = (session: Session) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const feed = yield* SessionFeed
    const branch = yield* (yield* Git).currentBranch(session.projectPath)
    for (const other of yield* store.listByProject(session.projectPath)) {
      if (!inCheckout(other)) continue
      yield* store.setWorkingFolder(other.id, other.workingFolder, branch)
      yield* feed.publish(other.id)
    }
    return (yield* store.findById(session.id)) ?? session
  })
