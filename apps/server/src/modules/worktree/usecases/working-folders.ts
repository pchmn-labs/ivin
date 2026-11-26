import { Context, type Effect } from "effect"

export class WorkingFolders extends Context.Service<
  WorkingFolders,
  {
    readonly exists: (path: string) => Effect.Effect<boolean>
    // The folder and what is in it; no-op when it is gone.
    readonly remove: (path: string) => Effect.Effect<void>
  }
>()("ivin/server/WorkingFolders") {}
