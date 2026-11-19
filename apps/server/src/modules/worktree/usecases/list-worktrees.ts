import { Effect } from "effect"
import { linkedWorktrees } from "../rules/linked-worktrees.ts"
import { Git } from "./git.ts"

export const listWorktrees = (projectPath: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const entries = yield* git.listWorktrees(projectPath).pipe(
      // Git fails outside a repository too, where the project simply has no worktree.
      Effect.tapError((error) =>
        Effect.logWarning(`could not list the worktrees of ${projectPath}`, error),
      ),
      Effect.orElseSucceed(() => []),
    )
    return linkedWorktrees(projectPath, entries)
  })
