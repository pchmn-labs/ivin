import { DateTime, Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import type { Session } from "@ivin/contracts/session"
import { makeEntityList } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const newestActivityFirst = (a: Session, b: Session) =>
  DateTime.toEpochMillis(b.lastActivityAt) - DateTime.toEpochMillis(a.lastActivityAt)

export const sessionsOf = strongFamily((projectPath: string) => {
  // Being archived: a change published while the agent stops must not list it again.
  const archiving = Atom.make<ReadonlyArray<string>>([]).pipe(Atom.keepAlive)
  const list = makeEntityList({
    id: (session: Session) => session.id,
    compare: newestActivityFirst,
    feed: {
      runtime: serverRuntime,
      run: (writer) =>
        Effect.gen(function* () {
          const client = yield* ServerClient
          yield* client["session.watch"]({ projectPath }).pipe(
            Stream.runForEach((change) =>
              change._tag === "changed"
                ? Effect.flatMap(Atom.get(archiving), (ids) =>
                    ids.includes(change.session.id) ? Effect.void : writer.upsert([change.session]),
                  )
                : writer.remove(change.sessionId),
            ),
          )
        }),
    },
  })
  return { ...list, archiving }
})
