import { ProjectNotTrusted } from "@ivin/contracts/project"
import {
  ApprovalNotOpen,
  QuestionNotOpen,
  SessionNotFound,
  type RunOptions,
  type Session,
  type SessionStatus,
  type PendingMessage,
  type WaitingFor,
} from "@ivin/contracts/session"
import type {
  HarnessDelta,
  HarnessEvent,
  HarnessOutput,
  ImageData,
} from "@ivin/contracts/transcript"
import {
  HarnessProvider,
  type ApprovalDecision,
  HarnessError,
  type QuestionAnswers,
  type RequestAnswer,
} from "@ivin/harness"
import {
  Cause,
  Context,
  DateTime,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Scope,
  Semaphore,
  Stream,
} from "effect"
import { applyEvent, emptyItemState } from "../../transcript/rules/derive-items.ts"
import {
  applyDelta,
  blockAfterEvent,
  finishedEventId,
  type StreamedBlock,
} from "../../transcript/rules/streamed-block.ts"
import { logError, logFailure } from "../../log/usecases/log-error.ts"
import { ProjectTrust } from "../../project/usecases/project-trust.ts"
import { ItemFeed } from "../../transcript/usecases/item-feed.ts"
import { TranscriptStore } from "../../transcript/usecases/transcript-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { runOptionsOf, sameRunOptions } from "../rules/run-options.ts"
import { followAgentWorktree } from "./follow-agent-worktree.ts"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

interface UserMessage {
  readonly id: string
  readonly text: string
  readonly images: readonly ImageData[]
}

const unsent = ({ id, text, images }: UserMessage | PendingMessage): PendingMessage => ({
  id,
  text,
  images: images.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
})

const userMessageEvent = (message: UserMessage | PendingMessage, steer = false): HarnessEvent => ({
  type: "user_message",
  text: message.text,
  images: unsent(message).images,
  // Left out of turn-starting messages, so they are stored as before steers existed.
  steer: steer || undefined,
  raw: null,
})

export class SessionRuns extends Context.Service<
  SessionRuns,
  {
    // A harness failure is stored in the transcript and fails the session, never the effect.
    // Fails with `SessionNotFound` when the session was deleted or archived since `session` was read.
    readonly send: (
      session: Session,
      message: UserMessage,
    ) => Effect.Effect<void, SessionNotFound | ProjectNotTrusted>
    // Fails with `ApprovalNotOpen` when the request is not pending; a harness failure fails the session.
    readonly answerApproval: (
      session: Session,
      answer: ApprovalDecision,
    ) => Effect.Effect<void, ApprovalNotOpen>
    // Fails with `QuestionNotOpen` when the questions are not pending; a harness failure fails the session.
    readonly answerQuestion: (
      session: Session,
      answer: QuestionAnswers,
    ) => Effect.Effect<void, QuestionNotOpen>
    // No-op with no run.
    readonly interrupt: (sessionId: string) => Effect.Effect<void>
    // Stops the turn so the agent takes the pending messages as the next one; no-op without any.
    readonly sendNow: (sessionId: string) => Effect.Effect<void>
    // No-op with no run.
    readonly stop: (sessionId: string) => Effect.Effect<void>
    // Stops the run, then runs `effect`, all before any other turn of the session starts.
    readonly close: <A, E, R>(
      sessionId: string,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>
    // True from the agent's start until it stops, idle between turns included.
    readonly isRunning: (sessionId: string) => Effect.Effect<boolean>
    // Appends to the transcript with or without a run.
    readonly record: (session: Session, event: HarnessEvent) => Effect.Effect<void>
  }
>()("ivin/server/SessionRuns") {}

interface ActiveRun {
  readonly cwd: string
  readonly options: RunOptions
  readonly busy: () => boolean
  readonly turn: () => number
  readonly turnStarted: Effect.Effect<void>
  readonly record: (event: HarnessEvent, id?: string) => Effect.Effect<void>
  readonly send: (message: UserMessage) => Effect.Effect<void, HarnessError>
  // False when no request of the answer's kind is open under its id.
  readonly decide: (answer: RequestAnswer) => Effect.Effect<boolean>
  readonly respond: (answer: RequestAnswer) => Effect.Effect<void, HarnessError>
  readonly interrupt: Effect.Effect<void>
  readonly fail: (error: HarnessError) => Effect.Effect<void>
  readonly end: Effect.Effect<void>
}

// Logs a failure of one cleanup step so the steps after it still run.
const guarded = <A, E, R>(action: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : logFailure(action, cause).pipe(Effect.as(undefined)),
    ),
  )

export const layerSessionRunsWith = (interruptDeadline: Duration.Input) =>
  Layer.effect(SessionRuns)(
    Effect.gen(function* () {
      const provider = yield* HarnessProvider
      const sessions = yield* SessionStore
      const transcript = yield* TranscriptStore
      const feed = yield* ItemFeed
      const sessionFeed = yield* SessionFeed
      const git = yield* Git
      const runs = new Map<string, ActiveRun>()
      const layerScope = yield* Effect.scope
      const locks = new Map<string, Semaphore.Semaphore>()
      // The run fiber's exit path must never take this lock: `stop` holds it while closing the run.
      const locked = <A, E, R>(sessionId: string, effect: Effect.Effect<A, E, R>) =>
        Effect.suspend(() => {
          const lock = locks.get(sessionId) ?? Semaphore.makeUnsafe(1)
          locks.set(sessionId, lock)
          return lock.withPermits(1)(effect)
        })

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

      const setStatus = (sessionId: string, status: SessionStatus, waitingFor: WaitingFor = null) =>
        DateTime.now.pipe(
          Effect.flatMap((at) => sessions.setStatus(sessionId, status, at, waitingFor)),
          Effect.andThen(sessionFeed.publish(sessionId)),
        )

      const offerPreviousOptions = (
        sessionId: string,
        options: RunOptions,
        message: string,
        error: string | null,
      ) =>
        Effect.gen(function* () {
          const previous = yield* sessions.confirmedRunOptions(sessionId)
          if (previous === null || sameRunOptions(previous, options)) return
          yield* sessions.setRelaunchFailure(sessionId, { previous, message, error })
          yield* sessionFeed.publish(sessionId)
        })

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
              const next = applyEvent(itemState, stored, provider.toolKind)
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

          const turnStatus = (status: "running" | "idle") =>
            writing.withPermits(1)(
              Effect.suspend(() =>
                status === "running" && itemState.openRequests.size > 0
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
            logError("harness run", error).pipe(
              Effect.andThen(
                guarded(
                  "record run error",
                  record({ type: "error", message: error.message, raw: null }),
                ),
              ),
              Effect.andThen(guarded("set failed status", setStatus(session.id, "failed"))),
            )

          return { record, decide, turnStatus, stream, fail }
        })

      const startRun = (session: Session, writer: Effect.Success<ReturnType<typeof makeWriter>>) =>
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const storedProviderSessionId = yield* sessions.providerSessionId(session.id)
          const options = runOptionsOf(session)
          const harness = yield* provider
            .start({
              sessionId: session.id,
              cwd: session.workingFolder,
              options,
              providerSessionId: storedProviderSessionId,
            })
            .pipe(
              Scope.provide(scope),
              Effect.onExit((exit) =>
                Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, Exit.void),
              ),
            )

          const end = Effect.suspend(() => {
            if (runs.get(session.id) === run) runs.delete(session.id)
            return guarded("stop agent", Scope.close(scope, Exit.void)).pipe(
              Effect.andThen(
                guarded("move pending messages to unread", sessions.markPendingUnread(session.id)),
              ),
            )
          })

          const follower = yield* followAgentWorktree(
            session,
            writer.record,
            provider.toolActivity,
          ).pipe(Effect.provideService(Git, git), Effect.provideService(SessionStore, sessions))

          let providerSessionId = storedProviderSessionId
          let busy = false
          let turn = 0
          let firstTurn: { readonly message: string; error: string | null } | null = null
          const endFirstTurn = Effect.suspend(() => {
            const turn = firstTurn
            if (turn === null) return Effect.void
            firstTurn = null
            return turn.error !== null
              ? offerPreviousOptions(session.id, options, turn.message, turn.error)
              : sessions.setConfirmedRunOptions(session.id, options)
          })
          const readMessage = (messageId: string) =>
            Effect.gen(function* () {
              const message = yield* sessions.takePendingMessage(session.id, messageId)
              if (message === null) return
              const steer = busy
              busy = true
              if (!steer) turn += 1
              if (!steer) yield* follower.turnStarted
              yield* writer.record(userMessageEvent(message, steer), message.id)
              if (!steer) yield* setStatus(session.id, "working")
            })
          const handle = (output: HarnessOutput) => {
            if (output.type === "delta") return writer.stream(output)
            if (output.type === "message_read") return readMessage(output.messageId)
            if (output.type === "provider_session") {
              if (output.providerSessionId === providerSessionId) return Effect.void
              providerSessionId = output.providerSessionId
              return sessions.setProviderSessionId(session.id, output.providerSessionId)
            }
            if (output.type === "status") {
              if (output.status === "running" && !busy) turn += 1
              busy = output.status === "running"
            }
            if (output.type === "error" && firstTurn !== null) firstTurn.error ??= output.message
            const turnEnded = output.type === "status" && output.status === "idle"
            return (turnEnded ? endFirstTurn : Effect.void).pipe(
              Effect.andThen(writer.record(output)),
              Effect.andThen(
                output.type === "status" ? writer.turnStatus(output.status) : Effect.void,
              ),
              Effect.andThen(follower.observe(output)),
            )
          }

          yield* Stream.runForEach(harness.events, handle).pipe(
            Effect.onExit((exit) => {
              if (Exit.isSuccess(exit)) {
                return end.pipe(
                  Effect.andThen(guarded("set idle status", setStatus(session.id, "idle"))),
                )
              }
              // The scope closing, which `end` already does, interrupts this fiber.
              if (Cause.hasInterruptsOnly(exit.cause)) return Effect.void
              const failure = Cause.findErrorOption(exit.cause)
              const error = Option.isSome(failure)
                ? failure.value
                : new HarnessError({ message: "ivin failed while running the agent" })
              return Effect.suspend(() => {
                if (firstTurn !== null) firstTurn.error ??= error.message
                return Option.isNone(failure)
                  ? logError("harness run", Cause.squash(exit.cause))
                  : Effect.void
              }).pipe(
                Effect.andThen(guarded("end first turn", endFirstTurn)),
                Effect.andThen(end),
                Effect.andThen(writer.fail(error)),
              )
            }),
            Effect.forkIn(scope),
          )

          let started = false
          const run: ActiveRun = {
            cwd: session.workingFolder,
            options,
            busy: () => busy,
            turn: () => turn,
            turnStarted: follower.turnStarted,
            record: writer.record,
            send: (message) =>
              Effect.suspend(() => {
                if (!started) firstTurn = { message: message.text, error: null }
                started = true
                return harness.send(message)
              }),
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
        Effect.suspend(() => {
          const existing = runs.get(session.id)
          const unchanged =
            existing?.cwd === session.workingFolder &&
            sameRunOptions(existing.options, runOptionsOf(session))
          if (existing && (unchanged || existing.busy())) return Effect.succeed(existing)
          // The session moved or changed run options since the run started: its next turn resumes with them.
          return (existing?.end ?? Effect.void).pipe(
            Effect.andThen(makeWriter(session)),
            Effect.flatMap((writer) =>
              startRun(session, writer).pipe(
                Effect.catchTag("HarnessError", (error) =>
                  writer
                    .record(userMessageEvent(message), message.id)
                    .pipe(
                      Effect.andThen(
                        offerPreviousOptions(
                          session.id,
                          runOptionsOf(session),
                          message.text,
                          error.message,
                        ),
                      ),
                      Effect.andThen(writer.fail(error)),
                      Effect.as(null),
                    ),
                ),
              ),
            ),
          )
        })

      const answerRequest = <E>(session: Session, answer: RequestAnswer, notOpen: E) =>
        locked(
          session.id,
          Effect.gen(function* () {
            const run = runs.get(session.id)
            if (!run || !(yield* run.decide(answer))) return yield* Effect.fail(notOpen)
            yield* run
              .respond(answer)
              .pipe(
                Effect.catchTag("HarnessError", (error) =>
                  run.end.pipe(Effect.andThen(run.fail(error))),
                ),
              )
          }),
        )

      const endInterrupted = (sessionId: string, run: ActiveRun) =>
        guarded("record interruption", run.record({ type: "interruption", raw: null })).pipe(
          Effect.andThen(run.end),
          Effect.andThen(guarded("set idle status", setStatus(sessionId, "idle"))),
        )

      // An agent that ignores the interrupt keeps its turn; stopping it is the only way out.
      const interruptTurn = (sessionId: string, run: ActiveRun) =>
        Effect.gen(function* () {
          const turn = run.turn()
          const turnOpen = run.busy()
          yield* run.interrupt
          if (!turnOpen) return
          yield* Effect.sleep(interruptDeadline).pipe(
            Effect.andThen(
              locked(
                sessionId,
                Effect.suspend(() =>
                  runs.get(sessionId) === run && run.busy() && run.turn() === turn
                    ? endInterrupted(sessionId, run)
                    : Effect.void,
                ),
              ),
            ),
            Effect.forkIn(layerScope),
          )
        })

      const stopRun = (sessionId: string) =>
        Effect.suspend(() => {
          const run = runs.get(sessionId)
          // Closing the run's scope also interrupts the fiber that would have set the status.
          return run ? run.end.pipe(Effect.andThen(setStatus(sessionId, "idle"))) : Effect.void
        })

      return {
        send: (given, message) =>
          locked(
            given.id,
            Effect.gen(function* () {
              const session = yield* sessions.findById(given.id)
              if (!session || session.archivedAt !== null) {
                return yield* new SessionNotFound({ sessionId: given.id })
              }
              const working = runs.get(session.id)
              if (working?.busy()) {
                yield* sessions.addPendingMessage(session.id, unsent(message))
                yield* sessionFeed.publish(session.id)
                return yield* working
                  .send(message)
                  .pipe(
                    Effect.catchTag("HarnessError", (error) =>
                      working.end.pipe(Effect.andThen(working.fail(error))),
                    ),
                  )
              }
              yield* setStatus(session.id, "working")
              const run = yield* runOf(session, message)
              if (!run) return
              yield* Effect.gen(function* () {
                // Mid-turn, a worktree the agent just made would be taken for one that was already there.
                if (!run.busy()) yield* run.turnStarted
                yield* run.record(userMessageEvent(message), message.id)
                yield* run
                  .send(message)
                  .pipe(
                    Effect.catchTag("HarnessError", (error) =>
                      run.end.pipe(Effect.andThen(run.fail(error))),
                    ),
                  )
              }).pipe(
                Effect.onError((cause) =>
                  Cause.hasInterruptsOnly(cause)
                    ? Effect.void
                    : logFailure("send message", cause).pipe(
                        Effect.andThen(run.end),
                        Effect.andThen(
                          run.fail(
                            new HarnessError({ message: "ivin failed while running the agent" }),
                          ),
                        ),
                      ),
                ),
              )
            }),
          ),
        answerApproval: (session, answer) =>
          answerRequest(
            session,
            answer,
            new ApprovalNotOpen({ sessionId: session.id, requestId: answer.requestId }),
          ),
        answerQuestion: (session, answer) =>
          answerRequest(
            session,
            answer,
            new QuestionNotOpen({ sessionId: session.id, requestId: answer.requestId }),
          ),
        interrupt: (sessionId) =>
          locked(
            sessionId,
            Effect.gen(function* () {
              const run = runs.get(sessionId)
              if (!run) return
              if ((yield* sessions.pendingMessages(sessionId)).length === 0) {
                return yield* interruptTurn(sessionId, run)
              }
              yield* endInterrupted(sessionId, run)
            }),
          ),
        sendNow: (sessionId) =>
          locked(
            sessionId,
            Effect.gen(function* () {
              const run = runs.get(sessionId)
              if (run && (yield* sessions.pendingMessages(sessionId)).length > 0) {
                yield* interruptTurn(sessionId, run)
              }
            }),
          ),
        stop: (sessionId) => locked(sessionId, stopRun(sessionId)),
        close: (sessionId, effect) =>
          locked(sessionId, stopRun(sessionId).pipe(Effect.andThen(effect))),
        isRunning: (sessionId) => Effect.sync(() => runs.has(sessionId)),
        record: (session, event) =>
          locked(
            session.id,
            Effect.suspend(
              () =>
                runs.get(session.id)?.record(event) ??
                makeWriter(session).pipe(Effect.flatMap((writer) => writer.record(event))),
            ),
          ),
      }
    }),
  )

export const layerSessionRuns = layerSessionRunsWith("10 seconds")
