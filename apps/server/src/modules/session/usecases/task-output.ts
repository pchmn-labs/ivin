import { Effect } from "effect"
import { SessionRuns } from "./session-runs.ts"

export const taskOutput = (sessionId: string, taskId: string) =>
  Effect.gen(function* () {
    return yield* (yield* SessionRuns).taskOutput(sessionId, taskId)
  })
