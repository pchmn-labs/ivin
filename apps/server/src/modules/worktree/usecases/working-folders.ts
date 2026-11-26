import { Context, type Effect } from "effect"

export class WorkingFolders extends Context.Service<
  WorkingFolders,
  {
    readonly exists: (path: string) => Effect.Effect<boolean>
    // The names in the folder; none when it is gone.
    readonly entries: (path: string) => Effect.Effect<readonly string[]>
    // The folder and what is in it; no-op when it is gone.
    readonly remove: (path: string) => Effect.Effect<void>
  }
>()("ivin/server/WorkingFolders") {}
