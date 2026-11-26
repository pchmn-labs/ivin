import { Effect } from "effect"
import { ProjectPluginTrustStore } from "./project-plugin-trust-store.ts"
import { ProjectPluginUpdates } from "./project-plugin-updates.ts"

export const markProjectChangesSeen = (project: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectPluginTrustStore
    if (store === null) return
    yield* store.markChangesSeen(project)
    yield* (yield* ProjectPluginUpdates).publish
  })
