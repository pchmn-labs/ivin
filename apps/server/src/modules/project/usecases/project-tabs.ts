import { Context, type Effect } from "effect"

export class ProjectTabs extends Context.Service<
  ProjectTabs,
  {
    // Also stops their agents and starts the cleanups that follow a tab's closing.
    readonly closeAll: (projectPath: string) => Effect.Effect<void>
  }
>()("ivin/server/ProjectTabs") {}
