import { Effect } from "effect"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const checkoutStatusOf = strongFamily((projectPath: string) =>
  serverRuntime.atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["worktree.checkoutStatus"]({ projectPath })
    }),
  ),
)
