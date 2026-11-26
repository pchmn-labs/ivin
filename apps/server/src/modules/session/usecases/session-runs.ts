import type { PluginBridge } from "../../plugin/usecases/plugin-bridge.ts"
import { ProjectNotTrusted } from "@ivin/contracts/project"
import {
  ApprovalNotOpen,
  QuestionNotOpen,
  SessionNotFound,
  type Session,
} from "@ivin/contracts/session"
import type { HarnessEvent } from "@ivin/contracts/transcript"
import {
  type HarnessProvider,
  type ApprovalDecision,
  type QuestionAnswers,
  type RequestAnswer,
} from "@ivin/harness"
import { Cause, Context, Duration, Effect, Layer, Semaphore } from "effect"
import { guarded, logFailure } from "../../log/usecases/log-error.ts"
import { sessionFolderTrusted } from "./session-trust.ts"
import type { ProjectStore } from "../../project/usecases/project-store.ts"
import type { ProjectTrust } from "../../project/usecases/project-trust.ts"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import type { ItemFeed } from "../../transcript/usecases/item-feed.ts"
import type { TranscriptStore } from "../../transcript/usecases/transcript-store.ts"
import type { Git } from "../../worktree/usecases/git.ts"
import { runOptionsOf, sameRunOptions } from "../rules/run-options.ts"
import { type UserMessage, unsent } from "../rules/user-message.ts"
import { type AgentRun, recordFailedStart, runFailed, startAgentRun } from "./agent-run.ts"
import { makeIdleStop } from "./idle-stop.ts"
import { SessionFeed } from "./session-feed.ts"
import { setSessionStatus } from "./session-status.ts"
import { SessionStore } from "./session-store.ts"
import {
  closeRequestsLeftOpen,
  openTranscriptWriter,
  type TranscriptWriter,
} from "./transcript-writer.ts"

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
    // No-op with no run. With only background tasks running, stops the agent and so its tasks.
    readonly interrupt: (sessionId: string) => Effect.Effect<void>
    // No-op with no run or no such listed task; else records the stop, then asks the agent.
    readonly stopTask: (sessionId: string, taskId: string) => Effect.Effect<void>
    // Stops the turn so the agent takes the pending messages as the next one; no-op without any.
    readonly sendNow: (sessionId: string) => Effect.Effect<void>
    // No-op with no run.
    readonly stop: (sessionId: string) => Effect.Effect<void>
    // Stops the run, then runs `effect`, all before any other turn of the session starts.
    readonly close: <A, E, R>(
      sessionId: string,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>
    // The end of a running background command's output, as the agent writes it; null with no such task.
    readonly taskOutput: (sessionId: string, taskId: string) => Effect.Effect<string | null>
    // True from the agent's start until it stops, idle between turns included.
    readonly isRunning: (sessionId: string) => Effect.Effect<boolean>
    // Appends to the transcript with or without a run.
    readonly record: (session: Session, event: HarnessEvent) => Effect.Effect<void>
  }
>()("ivin/server/SessionRuns") {}

// `idleLimit` is read each time a turn ends; 0 never stops the agent.
export const layerSessionRunsWith = (
  interruptDeadline: Duration.Input,
  idleLimit: Effect.Effect<Duration.Input> = Effect.succeed(0),
) =>
  Layer.effect(SessionRuns)(
    Effect.gen(function* () {
      const context = yield* Effect.context<
        | HarnessProvider
        | SessionStore
        | SessionFeed
        | TranscriptStore
        | ItemFeed
        | Git
        | PluginBridge
        | ProjectStore
        | ProjectTrust
      >()
      const sessions = yield* SessionStore
      const sessionFeed = yield* SessionFeed
      const runs = new Map<string, AgentRun>()
      const layerScope = yield* Effect.scope
      const locks = new Map<string, Semaphore.Semaphore>()
      const locked = <A, E, R>(sessionId: string, effect: Effect.Effect<A, E, R>) =>
        Effect.suspend(() => {
          const lock = locks.get(sessionId) ?? Semaphore.makeUnsafe(1)
          locks.set(sessionId, lock)
          return lock.withPermits(1)(effect)
        })

      const openWriter = (session: Session) =>
        openTranscriptWriter(session).pipe(Effect.provideContext(context))

      // Closed together: one scope after another would add every agent's kill grace.
      yield* Effect.addFinalizer(() =>
        Effect.suspend(() =>
          Effect.forEach([...runs.values()], (run) => run.end, {
            concurrency: "unbounded",
            discard: true,
          }),
        ),
      )

      // Forked out of the run's scope: stopping closes that scope, which would interrupt this fiber mid-stop.
      const later = (
        delay: Duration.Input,
        sessionId: string,
        run: AgentRun,
        effect: Effect.Effect<void>,
      ) =>
        Effect.sleep(delay).pipe(
          Effect.andThen(
            locked(
              sessionId,
              Effect.suspend(() => (runs.get(sessionId) === run ? effect : Effect.void)),
            ),
          ),
          Effect.forkIn(layerScope),
        )

      const idleStop = yield* makeIdleStop(idleLimit, later)

      const startRun = (session: Session, writer: TranscriptWriter) =>
        startAgentRun(session, writer, {
          turnEnded: (run) => idleStop.start(session.id, run, writer),
          ended: (run) =>
            Effect.suspend(() => {
              if (runs.get(session.id) === run) runs.delete(session.id)
              return idleStop.cancel(run)
            }),
        }).pipe(
          Effect.provideContext(context),
          Effect.tap((run) => Effect.sync(() => runs.set(session.id, run))),
        )

      const runOf = (session: Session, message: UserMessage) =>
        Effect.suspend(() => {
          const existing = runs.get(session.id)
          const unchanged =
            existing?.cwd === session.workingFolder &&
            sameRunOptions(existing.options, runOptionsOf(session))
          if (existing && (unchanged || existing.busy())) return Effect.succeed(existing)
          // The session moved or changed run options since the run started: its next turn resumes with them.
          return (existing?.end ?? Effect.void).pipe(
            Effect.andThen(openWriter(session)),
            // Requests an earlier run left open, such as before runs closed theirs, die with it.
            Effect.tap((writer) => writer.closeRequests),
            Effect.flatMap((writer) =>
              startRun(session, writer).pipe(
                Effect.catchTag("HarnessError", (error) =>
                  recordFailedStart(session, writer, message, error).pipe(
                    Effect.provideContext(context),
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
            if (!run || !(yield* run.answer(answer))) return yield* Effect.fail(notOpen)
          }),
        )

      // An agent that ignores the interrupt keeps its turn; stopping it is the only way out.
      const interruptTurn = (sessionId: string, run: AgentRun) =>
        Effect.gen(function* () {
          const turn = run.turn()
          const turnOpen = run.busy()
          yield* run.interrupt
          if (!turnOpen) return
          yield* later(
            interruptDeadline,
            sessionId,
            run,
            Effect.suspend(() =>
              run.busy() && run.turn() === turn ? run.stopInterrupted : Effect.void,
            ),
          )
        })

      // Closing the run's scope also interrupts the fiber that would have set the status.
      const stopRun = (sessionId: string) =>
        Effect.suspend(() => runs.get(sessionId)?.stop ?? Effect.void)

      yield* closeRequestsLeftOpen(yield* sessions.resetRunning).pipe(
        Effect.provideContext(context),
      )

      return {
        send: (given, message) =>
          locked(
            given.id,
            Effect.gen(function* () {
              const session = yield* sessions.findById(given.id)
              if (!session || session.archivedAt !== null) {
                return yield* new SessionNotFound({ sessionId: given.id })
              }
              if (!(yield* sessionFolderTrusted(session).pipe(Effect.provideContext(context))))
                return yield* new ProjectNotTrusted({ path: session.workingFolder })
              const working = runs.get(session.id)
              if (working?.busy()) {
                yield* sessions.addPendingMessage(session.id, unsent(message))
                yield* sessionFeed.publish(session.id)
                return yield* working.steer(message)
              }
              yield* setSessionStatus(session.id, "working")
              yield* Effect.gen(function* () {
                const run = yield* runOf(session, message)
                if (run) yield* run.start(message)
              }).pipe(
                Effect.onError((cause) => {
                  if (Cause.hasInterruptsOnly(cause)) return Effect.void
                  const run = runs.get(session.id)
                  return logFailure("send message", cause).pipe(
                    Effect.andThen(
                      run
                        ? run.fail(runFailed)
                        : guarded("set failed status", setSessionStatus(session.id, "failed")),
                    ),
                  )
                }),
              )
            }).pipe(Effect.provideContext(context)),
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
              // No turn to stop: the tasks run in the agent, so the agent stops.
              if (!run.busy() && run.hasTasks()) return yield* run.stopInterrupted
              const pending = yield* sessions.pendingMessages(sessionId)
              yield* pending.length === 0 ? interruptTurn(sessionId, run) : run.stopInterrupted
            }),
          ),
        stopTask: (sessionId, taskId) =>
          locked(
            sessionId,
            Effect.gen(function* () {
              const run = runs.get(sessionId)
              const task = (yield* sessions.findById(sessionId))?.backgroundTasks.find(
                (candidate) => candidate.taskId === taskId,
              )
              if (!run || !task) return
              yield* run.record({
                type: "task_stop",
                taskId,
                description: task.description,
                raw: null,
              })
              yield* run.stopTask(taskId)
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
        taskOutput: (sessionId, taskId) =>
          Effect.suspend(() => runs.get(sessionId)?.taskOutput(taskId) ?? Effect.succeed(null)),
        isRunning: (sessionId) => Effect.sync(() => runs.has(sessionId)),
        record: (session, event) =>
          locked(
            session.id,
            Effect.suspend(
              () =>
                runs.get(session.id)?.record(event) ??
                openWriter(session).pipe(Effect.flatMap((writer) => writer.record(event))),
            ),
          ),
      }
    }),
  )

export const layerSessionRuns = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* CurrentSettings
    return layerSessionRunsWith(
      "10 seconds",
      settings.get.pipe(Effect.map(({ agents }) => Duration.minutes(agents.stopWhenIdleMinutes))),
    )
  }),
)
