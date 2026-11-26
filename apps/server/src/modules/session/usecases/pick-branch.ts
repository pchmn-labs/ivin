import { CheckoutRefused, SessionNotFound, SessionWorking } from "@ivin/contracts/session"
import { Effect } from "effect"
import { resolveBranchPick } from "../../worktree/rules/branch-pick.ts"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { sessionProjectFolder } from "./session-project-folder.ts"
import { isBusy } from "../rules/busy-session.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const pickBranch = (sessionId: string, name: string, remote: boolean) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const git = yield* Git
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    if (isBusy(session)) return yield* new SessionWorking({ sessionId })

    const refused = (error: { readonly message: string }) =>
      new CheckoutRefused({ sessionId, gitMessage: error.message })
    // On a workspace, the branches are those of the project folder the session is in.
    const repository = isWorkspaceFile(session.projectPath)
      ? yield* sessionProjectFolder(session)
      : session.projectPath
    if (repository === null) {
      return yield* refused({
        message: "A working folder of several repositories has no one branch to pick.",
      })
    }
    const [branches, worktrees] = yield* Effect.all([
      git.listBranches(repository),
      git.listWorktrees(repository),
    ]).pipe(Effect.mapError(refused))
    const pick = resolveBranchPick(
      { name, remote },
      { workingFolder: session.workingFolder, branches, worktrees },
    )
    if (pick.kind === "unlisted") return yield* refused({ message: `No branch named ${name}` })
    if (pick.kind === "current") return session
    if (pick.kind === "checkout") {
      yield* git.checkout(session.workingFolder, pick.branch).pipe(Effect.mapError(refused))
    } else if (pick.kind === "track") {
      yield* git
        .checkoutTracking(session.workingFolder, pick.remote, pick.branch)
        .pipe(Effect.mapError(refused))
    }

    const path = pick.kind === "move" ? pick.path : session.workingFolder
    yield* store.setWorkingFolder(sessionId, path, pick.branch, path !== repository)
    yield* runs.record(session, {
      type: "working_folder",
      path,
      inWorktree: path !== repository,
      branch: pick.branch,
      cause: "branch_picker",
      // ivin created no folder here, so there is no untracked folder to warn about.
      worktreesIgnored: true,
      raw: null,
    })
    return (yield* store.findById(sessionId)) ?? session
  })
