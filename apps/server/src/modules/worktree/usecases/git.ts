import { Context, Data, type Effect } from "effect"
import type { Branches, WorktreeEntry } from "../rules/git-output.ts"

// `message` is git's own output.
export class GitError extends Data.TaggedError("GitError")<{ readonly message: string }> {}

export class Git extends Context.Service<
  Git,
  {
    readonly listWorktrees: (repo: string) => Effect.Effect<readonly WorktreeEntry[], GitError>
    readonly listBranches: (repo: string) => Effect.Effect<Branches, GitError>
    readonly hasRemote: (repo: string, remote: string) => Effect.Effect<boolean, GitError>
    // `origin/<name>` from `refs/remotes/origin/HEAD`, null when the clone never recorded it.
    readonly originHead: (repo: string) => Effect.Effect<string | null>
    readonly fetch: (repo: string, remote: string) => Effect.Effect<void, GitError>
    readonly createWorktree: (
      repo: string,
      worktree: { readonly path: string; readonly branch: string; readonly base: string },
    ) => Effect.Effect<void, GitError>
    readonly checkout: (folder: string, branch: string) => Effect.Effect<void, GitError>
    // `remote` is `origin/<name>`.
    readonly checkoutTracking: (
      folder: string,
      remote: string,
      branch: string,
    ) => Effect.Effect<void, GitError>
    // Null outside a repository and on a detached HEAD.
    readonly currentBranch: (folder: string) => Effect.Effect<string | null>
    readonly isIgnored: (repo: string, path: string) => Effect.Effect<boolean>
  }
>()("ivin/server/Git") {}
