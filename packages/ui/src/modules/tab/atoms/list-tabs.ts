import { Effect } from "effect"
import { makeFedState } from "@ivin/state/fed-state"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const tabsOf = strongFamily((projectPath: string) =>
  makeFedState({
    initial: { projectPath, tabs: [], selectedSessionId: null },
    runtime: serverRuntime,
    load: Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["tab.list"]({ projectPath })
    }),
  }),
)
