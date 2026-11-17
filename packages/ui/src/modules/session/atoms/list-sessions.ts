import { DateTime, Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { Session } from "@ivin/contracts/session"
import { makeEntityList } from "@ivin/state/entity-list"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const newestActivityFirst = (a: Session, b: Session) =>
  DateTime.toEpochMillis(b.lastActivityAt) - DateTime.toEpochMillis(a.lastActivityAt)

export const sessionsOf = Atom.family((projectPath: string) =>
  makeEntityList<Session>({
    id: (session) => session.id,
    compare: newestActivityFirst,
    feed: (writer) =>
      serverRuntime.atom(
        Effect.gen(function* () {
          // Writing to the atoms while the feed atom is still being built makes it rebuild itself.
          yield* Effect.yieldNow
          const client = yield* ServerClient
          yield* writer.upsert(yield* client["session.list"]({ projectPath }))
        }),
      ),
  }),
)
