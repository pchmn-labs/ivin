import type { OpenProjects, Project } from "@ivin/contracts/project"
import { Context, type Effect } from "effect"

export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    // Remembers the folder and when it was last opened, open or not.
    readonly save: (project: Pick<Project, "path" | "name" | "lastOpenedAt">) => Effect.Effect<void>
    // The project folders now: the folder itself, or those a `.code-workspace` file lists, in its
    // order; null when that file cannot be read or is not a workspace.
    readonly folders: (path: string) => Effect.Effect<readonly string[] | null>
    readonly isKnown: (path: string) => Effect.Effect<boolean>
    readonly listOpen: Effect.Effect<OpenProjects>
    // Appends at the end of the list; no-op if already open.
    readonly addOpen: (path: string) => Effect.Effect<void>
    readonly removeOpen: (path: string) => Effect.Effect<void>
    readonly select: (path: string | null) => Effect.Effect<void>
    readonly trust: (path: string) => Effect.Effect<void>
    readonly trustedProjects: Effect.Effect<ReadonlyArray<string>>
  }
>()("ivin/server/ProjectStore") {}
