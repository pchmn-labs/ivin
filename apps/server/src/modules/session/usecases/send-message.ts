import {
  type Session,
  SessionNotFound,
  type WorkingFolderChoice,
  WorktreeNotCreated,
} from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { createWorktree } from "../../worktree/usecases/create-worktree.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { listWorktrees } from "../../worktree/usecases/list-worktrees.ts"
import { titleFromMessage } from "../rules/session-title.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

const REASONS = {
  GitError: "git",
  FetchTimedOut: "fetch_timed_out",
  NoDefaultBranch: "no_default_branch",
} as const

const moveToNewWorktree = (session: Session) =>
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
    yield* store.setWorkingFolder(session.id, created.path, created.branch)
    yield* runs.record(session, {
      type: "working_folder",
      path: created.path,
      inWorktree: true,
      branch: created.branch,
      cause: "creation",
      worktreesIgnored: created.worktreesIgnored,
      raw: null,
    })
  })

const moveToExistingWorktree = (session: Session, path: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const worktree = (yield* listWorktrees(session.projectPath)).find((w) => w.path === path)
    if (!worktree) {
      return yield* new WorktreeNotCreated({ sessionId: session.id, reason: "not_a_worktree" })
    }
    yield* store.setWorkingFolder(session.id, worktree.path, worktree.branch)
    yield* runs.record(session, {
      type: "working_folder",
      path: worktree.path,
      inWorktree: true,
      branch: worktree.branch,
      cause: "choice",
      // ivin created no folder here, so there is no untracked folder to warn about.
      worktreesIgnored: true,
      raw: null,
    })
  })

export const sendMessage = (
  sessionId: string,
  messageId: string,
  text: string,
  workingFolder?: WorkingFolderChoice,
) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const git = yield* Git
    const found = yield* store.findById(sessionId)
    if (!found) return yield* new SessionNotFound({ sessionId })
    if (!found.started) {
      if (workingFolder?.kind === "new_worktree") {
        yield* moveToNewWorktree(found)
      } else if (workingFolder?.kind === "existing_worktree") {
        yield* moveToExistingWorktree(found, workingFolder.path)
      } else {
        // The user may have switched branches in the checkout since the session was created.
        yield* store.setWorkingFolder(
          sessionId,
          found.workingFolder,
          yield* git.currentBranch(found.workingFolder),
        )
      }
    }
    const title = titleFromMessage(text)
    if (title !== "") yield* store.setTitleIfUnset(sessionId, title)
    const session = (yield* store.findById(sessionId)) ?? found
    yield* runs.send(session, { id: messageId, text })
    return (yield* store.findById(sessionId)) ?? session
  })
