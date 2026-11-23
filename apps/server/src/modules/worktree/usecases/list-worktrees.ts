import { WorktreeGitFailed } from "@ivin/contracts/worktree"
import { Effect } from "effect"
import { linkedWorktrees } from "../rules/linked-worktrees.ts"
import { Git } from "./git.ts"

export const listWorktrees = (projectPath: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const entries = yield* git
      .listWorktrees(projectPath)
      .pipe(
        Effect.mapError(
          ({ message }) => new WorktreeGitFailed({ projectPath, gitMessage: message }),
        ),
      )
    return linkedWorktrees(projectPath, entries)
  })

// For callers that act on the list rather than show it: a failure means nothing to act on.
export const listWorktreesOrNone = (projectPath: string) =>
  listWorktrees(projectPath).pipe(
    Effect.catch((error) =>
      Effect.logWarning(`could not list the worktrees of ${projectPath}`, error).pipe(
        Effect.as([]),
      ),
    ),
  )
