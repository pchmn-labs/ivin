import { type Session, WorktreeNotCreated } from "@ivin/contracts/session"
import type { HarnessEvent } from "@ivin/contracts/transcript"
import { DateTime, Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { createWorkspaceWorkingFolder } from "../../worktree/usecases/create-workspace-working-folder.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { checkoutStart } from "../../worktree/rules/workspace-folder.ts"
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
    yield* (yield* SessionStore).setWorkingFolder(
      session.id,
      folder.path,
      folder.branch,
      folder.inWorktree,
    )
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
    const create = isWorkspaceFile(session.projectPath)
      ? createWorkspaceWorkingFolder(session.projectPath, session.id).pipe(
          Effect.map((made) => ({ ...made, worktreesIgnored: true })),
        )
      : createWorktree(session.projectPath, session.id)
    const created = yield* create.pipe(
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
    yield* moveTo(
      session,
      { path: worktree.path, branch: worktree.branch, inWorktree: true },
      cause,
      true,
    )
  })

export const moveToWorkspaceStart = (session: Session) =>
  Effect.gen(function* () {
    const git = yield* Git
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    // A project folder picked before the first message is kept.
    if (folders.includes(session.workingFolder)) {
      const branch = yield* git.currentBranch(session.workingFolder)
      return yield* (yield* SessionStore).setWorkingFolder(
        session.id,
        session.workingFolder,
        branch,
        false,
      )
    }
    for (const folder of folders) {
      if ((yield* git.gitDir(folder)) !== null) return yield* moveToNewWorktree(session, "creation")
    }
    const start = checkoutStart(folders)
    if (start !== null) {
      yield* (yield* SessionStore).setWorkingFolder(session.id, start.cwd, null, false)
    }
  })

// On a workspace, `folder` is one of its project folders; the first one without it.
export const moveToCheckout = (session: Session, cause: Cause, folder?: string) =>
  Effect.gen(function* () {
    let path = session.projectPath
    if (isWorkspaceFile(session.projectPath)) {
      const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
      if (folder !== undefined && !folders.includes(folder)) {
        return yield* new WorktreeNotCreated({
          sessionId: session.id,
          reason: "not_a_project_folder",
        })
      }
      path = folder ?? checkoutStart(folders)?.cwd ?? path
    }
    const branch = yield* (yield* Git).currentBranch(path)
    yield* moveTo(session, { path, inWorktree: false, branch }, cause, true)
  })
