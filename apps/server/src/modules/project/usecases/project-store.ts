import type { OpenProjects, Project } from "@ivin/contracts/project"
import { Context, type Effect } from "effect"

export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    // Remembers the folder and when it was last opened, open or not.
    readonly save: (project: Project) => Effect.Effect<void>
    readonly isKnown: (path: string) => Effect.Effect<boolean>
    readonly listOpen: Effect.Effect<OpenProjects>
    // Appends at the end of the list; no-op if already open.
    readonly addOpen: (path: string) => Effect.Effect<void>
    readonly removeOpen: (path: string) => Effect.Effect<void>
    readonly select: (path: string | null) => Effect.Effect<void>
    readonly trust: (path: string) => Effect.Effect<void>
    readonly trustedFolders: Effect.Effect<ReadonlyArray<string>>
  }
>()("ivin/server/ProjectStore") {}
