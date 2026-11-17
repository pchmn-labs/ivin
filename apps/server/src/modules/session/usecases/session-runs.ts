import type { Session } from "@ivin/contracts/session"
import type { HarnessDelta, HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import { HarnessProvider, type HarnessError } from "@ivin/harness"
import { Context, DateTime, Effect, Exit, Layer, Scope, Semaphore, Stream } from "effect"
import { applyEvent, emptyItemState } from "../../transcript/rules/derive-items.ts"
import {
  applyDelta,
  blockAfterEvent,
  finishedEventId,
  type StreamedBlock,
} from "../../transcript/rules/streamed-block.ts"
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
        const storedProviderSessionId = yield* sessions.providerSessionId(session.id)
        const harness = yield* provider
          .start({
            sessionId: session.id,
            cwd: session.projectPath,
            model: session.model,
            providerSessionId: storedProviderSessionId,
          })
          .pipe(
            Scope.provide(scope),
            Effect.tapError((error) => Scope.close(scope, Exit.fail(error))),
          )
        let sequence = yield* transcript.lastSequence(session.id)
        let itemState = emptyItemState
        let streamed: StreamedBlock | null = null
        const writing = yield* Semaphore.make(1)

        const record = (event: HarnessEvent, id?: string) =>
          writing.withPermits(1)(
            Effect.gen(function* () {
              const at = yield* DateTime.now
              sequence += 1
              const reserved =
                event.type === "assistant_text" || event.type === "thinking"
                  ? finishedEventId(streamed, event.type)
                  : undefined
              streamed = blockAfterEvent(streamed, event)
              const stored = {
                ...event,
                id: id ?? reserved ?? crypto.randomUUID(),
                sessionId: session.id,
                sequence,
                at,
              }
              yield* transcript.append(stored)
              yield* sessions.touch(session.id, at)
              const next = applyEvent(itemState, stored)
              itemState = next.state
              if (next.item) yield* feed.publish({ type: "upsert", item: next.item })
            }),
          )

        const stream = (delta: HarnessDelta) =>
          writing.withPermits(1)(
            Effect.suspend(() => {
              const next = applyDelta(streamed, itemState, sequence, delta, () =>
                crypto.randomUUID(),
              )
              streamed = next.block
              return feed.publish({ type: "delta", sessionId: session.id, ...next.change })
            }),
          )

        let providerSessionId = storedProviderSessionId
        const handle = (output: HarnessOutput) => {
          if (output.type === "delta") return stream(output)
          if (output.type !== "provider_session") return record(output)
          if (output.providerSessionId === providerSessionId) return Effect.void
          providerSessionId = output.providerSessionId
          return sessions.setProviderSessionId(session.id, output.providerSessionId)
        }

        yield* Stream.runForEach(harness.events, handle).pipe(
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
