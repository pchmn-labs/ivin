import { type Session, WorktreeNotCreated } from "@ivin/contracts/session"
import type { HarnessEvent } from "@ivin/contracts/transcript"
import { DateTime, Effect } from "effect"
import { createWorktree } from "../../worktree/usecases/create-worktree.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { listWorktreesOrNone } from "../../worktree/usecases/list-worktrees.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

type Cause = Extract<HarnessEvent, { type: "working_folder" }>["cause"]

const REASONS = {
  GitError: "git",
  FetchTimedOut: "fetch_timed_out",
  NoDefaultBranch: "no_default_branch",
} as const

const moveTo = (
  session: Session,
  folder: { path: string; inWorktree: boolean; branch: string | null },
  cause: Cause,
  worktreesIgnored: boolean,
) =>
  Effect.gen(function* () {
    yield* (yield* SessionStore).setWorkingFolder(session.id, folder.path, folder.branch)
    yield* (yield* SessionRuns).record(session, {
      type: "working_folder",
      ...folder,
      cause,
      worktreesIgnored,
      raw: null,
    })
  })

export const moveToNewWorktree = (session: Session, cause: Cause) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const feed = yield* SessionFeed
    const runs = yield* SessionRuns
    const setStatus = (status: Session["status"]) =>
      DateTime.now.pipe(
        Effect.flatMap((at) => store.setStatus(session.id, status, at)),
        Effect.andThen(feed.publish(session.id)),
      )

    yield* setStatus("preparing_worktree")
    const created = yield* createWorktree(session.projectPath, session.id).pipe(
      Effect.tapError((error) =>
        // Git's own output goes to the transcript as written, like a harness error.
        (error._tag === "GitError"
          ? runs.record(session, { type: "error", message: error.message, raw: null })
          : Effect.void
        ).pipe(Effect.andThen(setStatus("failed"))),
      ),
      Effect.mapError(
        (error) => new WorktreeNotCreated({ sessionId: session.id, reason: REASONS[error._tag] }),
      ),
    )
    yield* moveTo(
      session,
      { path: created.path, inWorktree: true, branch: created.branch },
      cause,
      created.worktreesIgnored,
    )
  })

export const moveToExistingWorktree = (session: Session, path: string, cause: Cause) =>
  Effect.gen(function* () {
    const worktree = (yield* listWorktreesOrNone(session.projectPath)).find((w) => w.path === path)
    if (!worktree) {
      return yield* new WorktreeNotCreated({ sessionId: session.id, reason: "not_a_worktree" })
    }
    // ivin created no folder here, so there is no untracked folder to warn about.
    yield* moveTo(session, { ...worktree, inWorktree: true }, cause, true)
  })

export const moveToCheckout = (session: Session, cause: Cause) =>
  Effect.gen(function* () {
    const branch = yield* (yield* Git).currentBranch(session.projectPath)
    yield* moveTo(session, { path: session.projectPath, inWorktree: false, branch }, cause, true)
  })
