import type { GitStatusEntry } from "@ivin/contracts/file"
import { Context, Data, type Effect } from "effect"
import type { Divergence } from "../rules/checkout-sync.ts"
import type { Branches, WorktreeEntry } from "../rules/git-output.ts"
import type { WorktreeState } from "../rules/worktree-removal.ts"

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
    // Tracked files only: untracked ones survive a checkout unless git names them.
    readonly hasLocalChanges: (folder: string) => Effect.Effect<boolean, GitError>
    readonly isClean: (folder: string) => Effect.Effect<boolean, GitError>
    // Squash merges included: a squashed branch is not an ancestor of `target`.
    readonly isMergedInto: (
      folder: string,
      target: string,
    ) => Effect.Effect<Pick<WorktreeState, "merged" | "hasCommits">, GitError>
    // Git refuses a worktree with changes.
    readonly removeWorktree: (repo: string, path: string) => Effect.Effect<void, GitError>
    // Untracked files included, so they no longer block a checkout or a fast-forward.
    readonly stash: (folder: string, message: string) => Effect.Effect<void, GitError>
    // Untracked files stay out, as the user was never shown them.
    readonly commitTracked: (folder: string, message: string) => Effect.Effect<void, GitError>
    readonly fastForward: (folder: string, upstream: string) => Effect.Effect<void, GitError>
    readonly divergence: (
      folder: string,
      branch: string,
      upstream: string,
    ) => Effect.Effect<Divergence, GitError>
    readonly isIgnored: (repo: string, path: string) => Effect.Effect<boolean>
    // Of the names in `folder`, those git ignores; none outside a repository.
    readonly ignoredNames: (
      folder: string,
      names: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlySet<string>>
    // Paths relative to `folder`, none outside a repository.
    readonly statusOf: (folder: string) => Effect.Effect<ReadonlyArray<GitStatusEntry>>
    // The repository's own folder for `folder`, which holds HEAD and the index; null outside a repository.
    readonly gitDir: (folder: string) => Effect.Effect<string | null>
    // Not ignored, untracked included and tracked-but-deleted left out, relative to `folder`; null outside a repository.
    readonly listFiles: (folder: string) => Effect.Effect<ReadonlyArray<string> | null>
  }
>()("ivin/server/Git") {}
