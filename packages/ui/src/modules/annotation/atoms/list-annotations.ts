import { DateTime, Effect, Stream } from "effect"
import type { Annotation } from "@ivin/contracts/annotation"
import { makeEntityList } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const oldestFirst = (a: Annotation, b: Annotation) =>
  DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt)

export const sessionAnnotationsOf = strongFamily((sessionId: string) =>
  makeEntityList({
    id: (annotation: Annotation) => annotation.id,
    compare: oldestFirst,
    feed: {
      runtime: serverRuntime,
      run: (writer) =>
        Effect.gen(function* () {
          const client = yield* ServerClient
          yield* client["annotation.watch"]({ target: { _tag: "session", sessionId } }).pipe(
            Stream.runForEach((change) =>
              change._tag === "changed"
                ? writer.upsert([change.annotation])
                : writer.remove(change.id),
            ),
          )
        }),
    },
  }),
)
