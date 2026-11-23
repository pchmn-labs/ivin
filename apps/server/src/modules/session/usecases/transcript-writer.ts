import type { Session } from "@ivin/contracts/session"
import type { HarnessDelta, HarnessEvent } from "@ivin/contracts/transcript"
import { HarnessProvider, type HarnessError, type RequestAnswer } from "@ivin/harness"
import { DateTime, Effect, Semaphore } from "effect"
import { guarded, logError } from "../../log/usecases/log-error.ts"
import { applyEvent, unansweredEvents } from "../../transcript/rules/derive-items.ts"
import {
  applyDelta,
  blockAfterEvent,
  finishedEventId,
  type StreamedBlock,
} from "../../transcript/rules/streamed-block.ts"
import { ensureItems } from "../../transcript/usecases/ensure-items.ts"
import { ItemFeed } from "../../transcript/usecases/item-feed.ts"
import { TranscriptStore } from "../../transcript/usecases/transcript-store.ts"
import { SessionFeed } from "./session-feed.ts"
import { setSessionStatus } from "./session-status.ts"
import type { SessionStore } from "./session-store.ts"

export type TranscriptWriter = Effect.Success<ReturnType<typeof openTranscriptWriter>>

export const openTranscriptWriter = (session: Session) =>
  Effect.gen(function* () {
    const provider = yield* HarnessProvider
    const transcript = yield* TranscriptStore
    const feed = yield* ItemFeed
    const sessionFeed = yield* SessionFeed
    const context = yield* Effect.context<SessionStore | SessionFeed>()
    const setStatus = (...args: Parameters<typeof setSessionStatus>) =>
      setSessionStatus(...args).pipe(Effect.provideContext(context))

    yield* ensureItems(session.id)
    let sequence = yield* transcript.lastSequence(session.id)
    let itemState = yield* transcript.itemState(session.id)
    let streamed: StreamedBlock | null = null
    const writing = yield* Semaphore.make(1)

    const write = (event: HarnessEvent, id?: string, { touch = true } = {}) =>
      Effect.gen(function* () {
        const at = yield* DateTime.now
        sequence += 1
        const reserved =
          event.type === "assistant_text" || event.type === "thinking"
            ? finishedEventId(streamed, event.type)
            : undefined
        streamed = blockAfterEvent(streamed, event)
        const { raw: _raw, ...body } = event
        const stored = {
          ...body,
          id: id ?? reserved ?? crypto.randomUUID(),
          sessionId: session.id,
          sequence,
          at,
        }
        const next = applyEvent(itemState, stored, provider.toolKind)
        yield* transcript.append(
          stored,
          {
            item: next.item,
            openMessageId: next.state.openMessage?.id ?? null,
          },
          touch ? at : null,
        )
        itemState = next.state
        if (next.item) yield* feed.publish({ type: "upsert", item: next.item })
        yield* sessionFeed.publish(session.id)
      })

    const record = (event: HarnessEvent, id?: string) =>
      writing.withPermits(1)(
        write(event, id).pipe(
          Effect.andThen(
            event.type === "approval_request"
              ? setStatus(session.id, "waiting", "approval")
              : event.type === "question_request"
                ? setStatus(session.id, "waiting", "question")
                : Effect.void,
          ),
        ),
      )

    // Check, decision and status share one permit so a turn-ending idle cannot land between them.
    const decide = (answer: RequestAnswer) =>
      writing.withPermits(1)(
        Effect.gen(function* () {
          const { requestId } = answer
          const kind = "allow" in answer ? "approval" : "question"
          if (itemState.openRequests.get(requestId)?.type !== kind) return false
          yield* write(
            "allow" in answer
              ? { type: "approval_decision", requestId, allow: answer.allow, raw: null }
              : { type: "question_answer", requestId, answers: answer.answers, raw: null },
          )
          const stillOpen = [...itemState.openRequests.values()].at(-1)
          yield* stillOpen === undefined
            ? setStatus(session.id, "working")
            : setStatus(session.id, "waiting", stillOpen.type)
          return true
        }),
      )

    // Not the user's activity, so the session keeps its place in the sidebar.
    const writeUnanswered = Effect.suspend(() =>
      Effect.forEach(
        unansweredEvents(itemState),
        (event) => write(event, undefined, { touch: false }),
        { discard: true },
      ),
    )

    const closeRequests = writing.withPermits(1)(writeUnanswered)

    const turnStatus = (status: "running" | "idle") =>
      writing.withPermits(1)(
        Effect.suspend(() =>
          status === "running" && itemState.openRequests.size > 0
            ? Effect.void
            : status === "idle"
              ? writeUnanswered.pipe(Effect.andThen(setStatus(session.id, "idle")))
              : setStatus(session.id, "working"),
        ),
      )

    const stream = (delta: HarnessDelta) =>
      writing.withPermits(1)(
        Effect.suspend(() => {
          const next = applyDelta(streamed, itemState, sequence, delta, () => crypto.randomUUID())
          streamed = next.block
          return feed.publish({ type: "delta", sessionId: session.id, ...next.change })
        }),
      )

    const fail = (error: HarnessError) =>
      logError("harness run", error).pipe(
        Effect.andThen(
          guarded("record run error", record({ type: "error", message: error.message, raw: null })),
        ),
        Effect.andThen(guarded("set failed status", setStatus(session.id, "failed"))),
      )

    const hasOpenRequests = () => itemState.openRequests.size > 0

    return { record, stream, decide, turnStatus, closeRequests, hasOpenRequests, fail }
  })
