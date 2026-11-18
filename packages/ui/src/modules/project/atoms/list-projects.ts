import { Effect } from "effect"
import { makeFedState } from "@ivin/state/fed-state"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const projectsAtom = makeFedState({
  initial: { projects: [], selectedPath: null },
  runtime: serverRuntime,
  load: Effect.gen(function* () {
    const client = yield* ServerClient
    return yield* client["project.list"]()
  }),
})
