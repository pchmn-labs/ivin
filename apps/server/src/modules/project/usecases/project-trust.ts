import { Context, type Effect } from "effect"

export class ProjectTrust extends Context.Service<
  ProjectTrust,
  {
    readonly isTrusted: (folder: string) => Effect.Effect<boolean>
    readonly trust: (folder: string) => Effect.Effect<void>
  }
>()("ivin/server/ProjectTrust") {}
