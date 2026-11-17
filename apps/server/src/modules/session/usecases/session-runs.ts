import type { Session } from "@ivin/contracts/session"
import type { HarnessEvent } from "@ivin/contracts/transcript"
import { HarnessProvider, type HarnessError } from "@ivin/harness"
import { Context, DateTime, Effect, Exit, Layer, Scope, Semaphore, Stream } from "effect"
import { applyEvent, emptyItemState } from "../../transcript/rules/derive-items.ts"
import { ItemFeed } from "../../transcript/usecases/item-feed.ts"
import { TranscriptStore } from "../../transcript/usecases/transcript-store.ts"
import { SessionStore } from "./session-store.ts"

export class SessionRuns extends Context.Service<
  SessionRuns,
  {
    readonly send: (
      session: Session,
      message: { readonly id: string; readonly text: string },
    ) => Effect.Effect<void, HarnessError>
  }
>()("ivin/server/SessionRuns") {}

interface ActiveRun {
  readonly record: (event: HarnessEvent, id?: string) => Effect.Effect<void>
  readonly send: (text: string) => Effect.Effect<void, HarnessError>
}

export const layerSessionRuns = Layer.effect(SessionRuns)(
  Effect.gen(function* () {
    const provider = yield* HarnessProvider
    const sessions = yield* SessionStore
    const transcript = yield* TranscriptStore
    const feed = yield* ItemFeed
    const serverScope = yield* Effect.scope
    const runs = new Map<string, ActiveRun>()
    const starting = yield* Semaphore.make(1)

    const startRun = (session: Session) =>
      Effect.gen(function* () {
        const scope = yield* Scope.fork(serverScope)
        const harness = yield* provider
          .start({ sessionId: session.id, cwd: session.projectPath })
          .pipe(
            Scope.provide(scope),
            Effect.tapError((error) => Scope.close(scope, Exit.fail(error))),
          )
        let sequence = yield* transcript.lastSequence(session.id)
        let itemState = emptyItemState
        const writing = yield* Semaphore.make(1)

        const record = (event: HarnessEvent, id?: string) =>
          writing.withPermits(1)(
            Effect.gen(function* () {
              const at = yield* DateTime.now
              sequence += 1
              const stored = {
                ...event,
                id: id ?? crypto.randomUUID(),
                sessionId: session.id,
                sequence,
                at,
              }
              yield* transcript.append(stored)
              yield* sessions.touch(session.id, at)
              const next = applyEvent(itemState, stored)
              itemState = next.state
              if (next.item) yield* feed.publish(next.item)
            }),
          )

        yield* Stream.runForEach(harness.events, (event) => record(event)).pipe(
          Effect.catchTag("HarnessError", (error) => Effect.logError(error.message)),
          Effect.ensuring(
            Effect.suspend(() => {
              runs.delete(session.id)
              return Scope.close(scope, Exit.void)
            }),
          ),
          Effect.forkIn(serverScope),
        )

        const run: ActiveRun = { record, send: (text) => harness.send({ text }) }
        runs.set(session.id, run)
        return run
      })

    const runOf = (session: Session) =>
      starting.withPermits(1)(
        Effect.suspend(() => {
          const existing = runs.get(session.id)
          return existing ? Effect.succeed(existing) : startRun(session)
        }),
      )

    return {
      send: (session, message) =>
        Effect.gen(function* () {
          const run = yield* runOf(session)
          yield* run.record({ type: "user_message", text: message.text, raw: null }, message.id)
          yield* run.send(message.text)
        }),
    }
  }),
)
