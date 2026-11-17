import { Effect } from "effect"
import { ProjectStore } from "./project-store.ts"

export const getCurrentProject = Effect.gen(function* () {
  const store = yield* ProjectStore
  return yield* store.findLastOpened
})
