import { Context, type Effect } from "effect"

export class FolderTrust extends Context.Service<
  FolderTrust,
  {
    // True inside a trusted project, and in any worktree of a trusted project's repository.
    readonly isTrusted: (folder: string) => Effect.Effect<boolean>
    readonly trust: (folder: string) => Effect.Effect<void>
  }
>()("ivin/server/FolderTrust") {}
