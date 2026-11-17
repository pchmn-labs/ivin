import { DateTime, Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { Session } from "@ivin/contracts/session"
import { makeEntityList } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const newestActivityFirst = (a: Session, b: Session) =>
  DateTime.toEpochMillis(b.lastActivityAt) - DateTime.toEpochMillis(a.lastActivityAt)

export const sessionsOf = strongFamily((projectPath: string) =>
  makeEntityList({
    id: (session: Session) => session.id,
    compare: newestActivityFirst,
    feed: {
      runtime: serverRuntime,
      run: (writer) =>
        Effect.gen(function* () {
          const client = yield* ServerClient
          yield* writer.upsert(yield* client["session.list"]({ projectPath }))
        }),
    },
  }),
)

export const sessionArrayOf = strongFamily((projectPath: string) => {
  const sessions = sessionsOf(projectPath)
  return Atom.readable((get) =>
    get(sessions.ids).flatMap((id) => {
      const session = get(sessions.item(id))
      return session ? [session] : []
    }),
  )
})
