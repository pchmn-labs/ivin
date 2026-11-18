import { Effect } from "effect"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { SessionRuns } from "./session-runs.ts"

export const stopAgentOnTabClose = (sessionIds: readonly string[]) =>
  Effect.gen(function* () {
    const { tabs } = yield* (yield* CurrentSettings).get
    if (!tabs.stopAgentOnClose) return
    const runs = yield* SessionRuns
    yield* Effect.forEach(sessionIds, runs.stop, { concurrency: "unbounded", discard: true })
  })
