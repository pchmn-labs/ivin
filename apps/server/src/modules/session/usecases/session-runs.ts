import { ApprovalNotOpen, type Session } from "@ivin/contracts/session"
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
import { SessionStore } from "./session-store.ts"

export class SessionRuns extends Context.Service<
  SessionRuns,
  {
    readonly send: (
      session: Session,
      message: { readonly id: string; readonly text: string },
    ) => Effect.Effect<void, HarnessError>
    readonly answerApproval: (
      session: Session,
      answer: ApprovalDecision,
    ) => Effect.Effect<void, HarnessError | ApprovalNotOpen>
  }
>()("ivin/server/SessionRuns") {}

interface ActiveRun {
  readonly record: (event: HarnessEvent, id?: string) => Effect.Effect<void>
  readonly send: (text: string) => Effect.Effect<void, HarnessError>
  readonly decide: (decision: ApprovalDecision) => Effect.Effect<void, ApprovalNotOpen>
  readonly respond: (decision: ApprovalDecision) => Effect.Effect<void, HarnessError>
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

        const writeUnlocked = (event: HarnessEvent, id?: string) =>
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
            if (event.type === "status") yield* sessions.setStatus(session.id, event.status)
            const next = applyEvent(itemState, stored)
            itemState = next.state
            if (next.item) yield* feed.publish({ type: "upsert", item: next.item })
          })

        const record = (event: HarnessEvent, id?: string) =>
          writing.withPermits(1)(
            Effect.gen(function* () {
              yield* writeUnlocked(event, id)
              if (event.type === "approval_request") {
                yield* writeUnlocked({ type: "status", status: "waiting_for_approval", raw: null })
              }
            }),
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
              yield* writeUnlocked({ type: "approval_decision", ...decision, raw: null })
              yield* writeUnlocked({
                type: "status",
                status: itemState.openApprovals.size > 0 ? "waiting_for_approval" : "running",
                raw: null,
              })
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
              return sessions
                .setStatus(session.id, "idle")
                .pipe(Effect.andThen(Scope.close(scope, Exit.void)))
            }),
          ),
          Effect.forkIn(serverScope),
        )

        const run: ActiveRun = {
          record,
          send: (text) => harness.send({ text }),
          decide,
          respond: harness.respond,
        }
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
          yield* run.respond(answer)
        }),
    }
  }),
)
