import { Effect } from "effect"
import { pruneSubViews, readSubViews } from "./sub-views-of.ts"

export const listSubViews = (sessionId: string) =>
  Effect.gen(function* () {
    yield* pruneSubViews(sessionId)
    return yield* readSubViews(sessionId)
  })
