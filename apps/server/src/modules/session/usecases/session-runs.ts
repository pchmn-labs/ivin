import { ApprovalNotOpen, type Session, type SessionStatus } from "@ivin/contracts/session"
import type { HarnessDelta, HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import { HarnessProvider, type ApprovalDecision, type HarnessError } from "@ivin/harness"
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
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

interface UserMessage {
  readonly id: string
  readonly text: string
}

export class SessionRuns extends Context.Service<
  SessionRuns,
  {
    // A harness failure is stored in the transcript and fails the session, never the effect.
    readonly send: (session: Session, message: UserMessage) => Effect.Effect<void>
    // Fails with `ApprovalNotOpen` when the request is not pending; a harness failure fails the session.
    readonly answerApproval: (
      session: Session,
      answer: ApprovalDecision,
    ) => Effect.Effect<void, ApprovalNotOpen>
    // No-op with no run.
    readonly interrupt: (sessionId: string) => Effect.Effect<void>
  }
>()("ivin/server/SessionRuns") {}

interface ActiveRun {
  readonly record: (event: HarnessEvent, id?: string) => Effect.Effect<void>
  readonly send: (text: string) => Effect.Effect<void, HarnessError>
  readonly decide: (decision: ApprovalDecision) => Effect.Effect<void, ApprovalNotOpen>
  readonly respond: (decision: ApprovalDecision) => Effect.Effect<void, HarnessError>
  readonly interrupt: Effect.Effect<void>
  readonly fail: (error: HarnessError) => Effect.Effect<void>
  readonly end: Effect.Effect<void>
}

export const layerSessionRuns = Layer.effect(SessionRuns)(
  Effect.gen(function* () {
    const provider = yield* HarnessProvider
    const sessions = yield* SessionStore
    const transcript = yield* TranscriptStore
    const feed = yield* ItemFeed
    const sessionFeed = yield* SessionFeed
    const runs = new Map<string, ActiveRun>()
    const starting = yield* Semaphore.make(1)

    yield* sessions.resetRunning

    // Closed together: one scope after another would add every agent's kill grace.
    yield* Effect.addFinalizer(() =>
      Effect.suspend(() =>
        Effect.forEach([...runs.values()], (run) => run.end, {
          concurrency: "unbounded",
          discard: true,
        }),
      ),
    )

    const setStatus = (sessionId: string, status: SessionStatus) =>
      sessions.setStatus(sessionId, status).pipe(Effect.andThen(sessionFeed.publish(sessionId)))

    const makeWriter = (session: Session) =>
      Effect.gen(function* () {
        let sequence = yield* transcript.lastSequence(session.id)
        let itemState = emptyItemState
        let streamed: StreamedBlock | null = null
        const writing = yield* Semaphore.make(1)

        const write = (event: HarnessEvent, id?: string) =>
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
            yield* sessionFeed.publish(session.id)
          })

        const record = (event: HarnessEvent, id?: string) =>
          writing.withPermits(1)(
            write(event, id).pipe(
              Effect.andThen(
                event.type === "approval_request" ? setStatus(session.id, "waiting") : Effect.void,
              ),
            ),
          )

        // Check, decision and status share one permit so a turn-ending idle cannot land between them.
        const decide = (decision: ApprovalDecision) =>
          writing.withPermits(1)(
            Effect.gen(function* () {
              if (!itemState.openApprovals.has(decision.requestId)) {
                return yield* new ApprovalNotOpen({
                  sessionId: session.id,
                  requestId: decision.requestId,
                })
              }
              yield* write({ type: "approval_decision", ...decision, raw: null })
              yield* setStatus(session.id, itemState.openApprovals.size > 0 ? "waiting" : "working")
            }),
          )

        const turnStatus = (status: "running" | "idle") =>
          writing.withPermits(1)(
            Effect.suspend(() =>
              status === "running" && itemState.openApprovals.size > 0
                ? Effect.void
                : setStatus(session.id, status === "idle" ? "idle" : "working"),
            ),
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

        const fail = (error: HarnessError) =>
          record({ type: "error", message: error.message, raw: null }).pipe(
            Effect.andThen(setStatus(session.id, "failed")),
          )

        return { record, decide, turnStatus, stream, fail }
      })

    const startRun = (session: Session, writer: Effect.Success<ReturnType<typeof makeWriter>>) =>
      Effect.gen(function* () {
        const scope = yield* Scope.make()
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

        const end = Effect.suspend(() => {
          if (runs.get(session.id) === run) runs.delete(session.id)
          return Scope.close(scope, Exit.void)
        })

        let providerSessionId = storedProviderSessionId
        const handle = (output: HarnessOutput) => {
          if (output.type === "delta") return writer.stream(output)
          if (output.type === "provider_session") {
            if (output.providerSessionId === providerSessionId) return Effect.void
            providerSessionId = output.providerSessionId
            return sessions.setProviderSessionId(session.id, output.providerSessionId)
          }
          return writer
            .record(output)
            .pipe(
              Effect.andThen(
                output.type === "status" ? writer.turnStatus(output.status) : Effect.void,
              ),
            )
        }

        yield* Stream.runForEach(harness.events, handle).pipe(
          Effect.andThen(end.pipe(Effect.andThen(setStatus(session.id, "idle")))),
          Effect.catchTag("HarnessError", (error) => end.pipe(Effect.andThen(writer.fail(error)))),
          Effect.forkIn(scope),
        )

        const run: ActiveRun = {
          record: writer.record,
          send: (text) => harness.send({ text }),
          decide: writer.decide,
          respond: harness.respond,
          interrupt: harness.interrupt,
          fail: writer.fail,
          end,
        }
        runs.set(session.id, run)
        return run
      })

    const runOf = (session: Session, message: UserMessage) =>
      starting.withPermits(1)(
        Effect.suspend(() => {
          const existing = runs.get(session.id)
          if (existing) return Effect.succeed(existing)
          return makeWriter(session).pipe(
            Effect.flatMap((writer) =>
              startRun(session, writer).pipe(
                Effect.catchTag("HarnessError", (error) =>
                  writer
                    .record({ type: "user_message", text: message.text, raw: null }, message.id)
                    .pipe(Effect.andThen(writer.fail(error)), Effect.as(null)),
                ),
              ),
            ),
          )
        }),
      )

    return {
      send: (session, message) =>
        Effect.gen(function* () {
          yield* setStatus(session.id, "working")
          const run = yield* runOf(session, message)
          if (!run) return
          yield* run.record({ type: "user_message", text: message.text, raw: null }, message.id)
          yield* run
            .send(message.text)
            .pipe(
              Effect.catchTag("HarnessError", (error) =>
                run.end.pipe(Effect.andThen(run.fail(error))),
              ),
            )
        }),
      answerApproval: (session, answer) =>
        Effect.gen(function* () {
          const run = runs.get(session.id)
          if (!run) {
            return yield* new ApprovalNotOpen({
              sessionId: session.id,
              requestId: answer.requestId,
            })
          }
          yield* run.decide(answer)
          yield* run
            .respond(answer)
            .pipe(
              Effect.catchTag("HarnessError", (error) =>
                run.end.pipe(Effect.andThen(run.fail(error))),
              ),
            )
        }),
      interrupt: (sessionId) => Effect.suspend(() => runs.get(sessionId)?.interrupt ?? Effect.void),
    }
  }),
)
