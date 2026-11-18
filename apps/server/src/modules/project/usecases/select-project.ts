import { ProjectNotOpen } from "@ivin/contracts/project"
import { Effect } from "effect"
import { ProjectStore } from "./project-store.ts"

export const selectProject = (path: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const open = yield* store.listOpen
    if (!open.projects.some((project) => project.path === path)) {
      return yield* new ProjectNotOpen({ path })
    }
    yield* store.select(path)
    return yield* store.listOpen
  })
