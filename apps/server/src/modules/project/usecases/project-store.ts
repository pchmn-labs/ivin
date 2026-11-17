import type { Project } from "@ivin/contracts/project"
import { Context, type Effect } from "effect"

export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    readonly save: (project: Project) => Effect.Effect<void>
    readonly findLastOpened: Effect.Effect<Project | null>
  }
>()("ivin/server/ProjectStore") {}
