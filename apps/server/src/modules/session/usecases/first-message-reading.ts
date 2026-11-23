import type { Session } from "@ivin/contracts/session"
import { HarnessProvider } from "@ivin/harness"
import { Context, Effect, FiberSet, Layer } from "effect"
import { addAnnotation } from "../../annotation/usecases/add-annotation.ts"
import type { AnnotationFeed } from "../../annotation/usecases/annotation-feed.ts"
import type { AnnotationStore } from "../../annotation/usecases/annotation-store.ts"
import { logFailure } from "../../log/usecases/log-error.ts"
import type { ProjectStore } from "../../project/usecases/project-store.ts"
import { firstMessagePrompt, readingOf } from "../rules/first-message-reading.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export class FirstMessageReading extends Context.Service<
  FirstMessageReading,
  {
    // Returns at once: the title and the citation arrive while the first turn runs.
    readonly read: (session: Session, text: string) => Effect.Effect<void>
    readonly settled: Effect.Effect<void>
  }
>()("ivin/server/FirstMessageReading") {}

const readFirstMessage = (session: Session, text: string) =>
  Effect.gen(function* () {
    const { completeText } = yield* HarnessProvider
    if (completeText === null) return
    const reading = readingOf(yield* completeText(firstMessagePrompt(text)), text)
    const store = yield* SessionStore
    if (reading.title !== null && (yield* store.replaceMessageTitle(session.id, reading.title))) {
      yield* (yield* SessionFeed).publish(session.id)
    }
    if (reading.citation !== null) {
      yield* addAnnotation({ _tag: "session", sessionId: session.id }, "ivin", "citation", {
        ...reading.citation,
      })
    }
  })

export const layerFirstMessageReading = Layer.effect(FirstMessageReading)(
  Effect.gen(function* () {
    const context = yield* Effect.context<
      HarnessProvider | SessionStore | SessionFeed | AnnotationStore | AnnotationFeed | ProjectStore
    >()
    const fibers = yield* FiberSet.make()
    return {
      read: (session, text) =>
        FiberSet.run(
          fibers,
          readFirstMessage(session, text).pipe(
            Effect.catchCause((cause) => logFailure("first message reading", cause)),
            Effect.provideContext(context),
          ),
        ).pipe(Effect.asVoid),
      settled: FiberSet.awaitEmpty(fibers),
    }
  }),
)
