import { Effect } from "effect"
import { linkedWorktrees } from "../rules/linked-worktrees.ts"
import { Git } from "./git.ts"

// Outside a git repository, git fails and the project has no worktree.
export const listWorktrees = (projectPath: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const entries = yield* git.listWorktrees(projectPath).pipe(Effect.orElseSucceed(() => []))
    return linkedWorktrees(projectPath, entries)
  })
