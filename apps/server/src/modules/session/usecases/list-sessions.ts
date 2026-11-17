import { Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const listSessions = (projectPath: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    return yield* store.listByProject(projectPath)
  })
