import type { Project } from "@ivin/contracts/project"
import { DateTime, Effect } from "effect"
import { projectName } from "../rules/project-name.ts"
import { ProjectStore } from "./project-store.ts"

export const openProject = (path: string): Effect.Effect<Project, never, ProjectStore> =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const project: Project = {
      path,
      name: projectName(path),
      lastOpenedAt: yield* DateTime.now,
    }
    yield* store.save(project)
    return project
  })
