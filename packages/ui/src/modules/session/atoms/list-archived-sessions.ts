import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const archivedSessionsOf = Atom.family((projectPath: string) =>
  serverRuntime.atom(
    Effect.gen(function* () {
      const client = yield* ServerClient
      return yield* client["session.listArchived"]({ projectPath })
    }),
  ),
)
