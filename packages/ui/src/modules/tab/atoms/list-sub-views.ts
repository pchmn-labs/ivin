import { Effect } from "effect"
import { makeFedState } from "@ivin/state/fed-state"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const family = strongFamily((key: string) => {
  const sessionId = key.slice(0, key.indexOf("\n"))
  return makeFedState({
    initial: {
      sessionId,
      subViews: [],
      selected: null,
      fullWidth: false,
      sessionTabSelected: false,
    },
    runtime: serverRuntime,
    load: Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["tab.listSubViews"]({ sessionId })
    }),
  })
})

export const subViewsOf = (sessionId: string, workingFolder: string) =>
  family(`${sessionId}\n${workingFolder}`)
