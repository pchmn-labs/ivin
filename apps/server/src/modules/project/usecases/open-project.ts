import { DateTime, Effect } from "effect"
import { projectName } from "../rules/project-name.ts"
import { ProjectStore } from "./project-store.ts"

export const openProject = (path: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    yield* store.save({ path, name: projectName(path), lastOpenedAt: yield* DateTime.now })
    yield* store.addOpen(path)
    yield* store.select(path)
    return yield* store.listOpen
  })
