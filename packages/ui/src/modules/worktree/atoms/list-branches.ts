import { Effect, Stream } from "effect"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const branchesOf = strongFamily((projectPath: string) =>
  serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["worktree.listBranches"]({ projectPath })
      }),
    ),
  ),
)
