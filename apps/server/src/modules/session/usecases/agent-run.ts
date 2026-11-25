import type { RunOptions, Session } from "@ivin/contracts/session"
import type { HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import { HarnessError, HarnessProvider, type RequestAnswer } from "@ivin/harness"
import { Cause, Effect, Exit, Option, Scope, Stream } from "effect"
import { guarded, logError } from "../../log/usecases/log-error.ts"
import { type FirstTurn, firstTurnOutcome, runOptionsOf } from "../rules/run-options.ts"
import { type UserMessage, userMessageEvent } from "../rules/user-message.ts"
import { followAgentWorktree } from "./follow-agent-worktree.ts"
import { SessionFeed } from "./session-feed.ts"
import { setSessionStatus } from "./session-status.ts"
import { SessionStore } from "./session-store.ts"
import type { TranscriptWriter } from "./transcript-writer.ts"

export interface AgentRun {
  readonly cwd: string
  readonly options: RunOptions
  readonly busy: () => boolean
  readonly turn: () => number
  readonly hasTasks: () => boolean
  // The end of a running background command's output, as the agent writes it; null with no such task.
  readonly taskOutput: (taskId: string) => Effect.Effect<string | null>
  // Stops one background task; the agent reports its end like any other.
  readonly stopTask: (taskId: string) => Effect.Effect<void>
  readonly record: (event: HarnessEvent) => Effect.Effect<void>
  // Starts a turn with the message; a harness failure ends the run and fails the session.
  readonly start: (message: UserMessage) => Effect.Effect<void>
  // Hands the agent a message during its turn; a harness failure ends the run and fails the session.
  readonly steer: (message: UserMessage) => Effect.Effect<void>
  // False when no request of the answer's kind is open under its id.
  readonly answer: (answer: RequestAnswer) => Effect.Effect<boolean>
  readonly interrupt: Effect.Effect<void>
  readonly end: Effect.Effect<void>
  readonly stop: Effect.Effect<void>
  readonly stopInterrupted: Effect.Effect<void>
  // Ends the run, then records the error and fails the session.
  readonly fail: (error: HarnessError) => Effect.Effect<void>
}

export interface AgentRunHooks {
  readonly turnEnded: (run: AgentRun) => Effect.Effect<void>
  // Runs first when the run ends, whatever ends it.
  readonly ended: (run: AgentRun) => Effect.Effect<void>
}

export const runFailed = new HarnessError({ message: "ivin failed while running the agent" })

export const settleFirstTurn = (sessionId: string, options: RunOptions, firstTurn: FirstTurn) =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore
    const outcome = firstTurnOutcome(
      firstTurn.error === null ? null : yield* sessions.confirmedRunOptions(sessionId),
      options,
      firstTurn,
    )
    if (outcome.type === "confirmed") {
      yield* sessions.setConfirmedRunOptions(sessionId, options)
    } else if (outcome.type === "relaunchFailure") {
      yield* sessions.setRelaunchFailure(sessionId, outcome.failure)
      yield* (yield* SessionFeed).publish(sessionId)
    }
  })

// The agent never started, so the message that would have started it is stored with the failure.
export const recordFailedStart = (
  session: Session,
  writer: TranscriptWriter,
  message: UserMessage,
  error: HarnessError,
) =>
  writer.record(userMessageEvent(message), message.id).pipe(
    Effect.andThen(
      settleFirstTurn(session.id, runOptionsOf(session), {
        message: message.text,
        error: error.message,
      }),
    ),
    Effect.andThen(writer.fail(error)),
  )

export const startAgentRun = (session: Session, writer: TranscriptWriter, hooks: AgentRunHooks) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    return yield* buildRun(session, writer, hooks, scope).pipe(
      Effect.onError(() => Scope.close(scope, Exit.void)),
    )
  })

const buildRun = (
  session: Session,
  writer: TranscriptWriter,
  hooks: AgentRunHooks,
  scope: Scope.Closeable,
) =>
  Effect.gen(function* () {
    const provider = yield* HarnessProvider
    const sessions = yield* SessionStore
    const context = yield* Effect.context<SessionStore | SessionFeed>()
    const setStatus = (...args: Parameters<typeof setSessionStatus>) =>
      setSessionStatus(...args).pipe(Effect.provideContext(context))

    const storedProviderSessionId = yield* sessions.providerSessionId(session.id)
    const options = runOptionsOf(session)
    const harness = yield* provider
      .start({
        sessionId: session.id,
        cwd: session.workingFolder,
        options,
        providerSessionId: storedProviderSessionId,
      })
      .pipe(Scope.provide(scope))

    const follower = yield* followAgentWorktree(session, writer.record, provider.toolActivity)

    let providerSessionId = storedProviderSessionId
    // The file each running task writes its output to, until the run ends.
    const taskFiles = new Map<string, string>()
    let busy = false
    let turn = 0
    let started = false
    let firstTurn: { readonly message: string; error: string | null } | null = null
    const endFirstTurn = Effect.suspend(() => {
      const first = firstTurn
      if (first === null) return Effect.void
      firstTurn = null
      return settleFirstTurn(session.id, options, first).pipe(Effect.provideContext(context))
    })

    const end: Effect.Effect<void> = Effect.suspend(() =>
      hooks
        .ended(run)
        .pipe(
          Effect.andThen(guarded("stop agent", Scope.close(scope, Exit.void))),
          Effect.andThen(guarded("close open requests", writer.closeRequests)),
          Effect.andThen(
            guarded("move pending messages to unread", sessions.markPendingUnread(session.id)),
          ),
        ),
    )
    const stop = end.pipe(Effect.andThen(guarded("set idle status", setStatus(session.id, "idle"))))
    const fail = (error: HarnessError) => end.pipe(Effect.andThen(writer.fail(error)))
    const send = (message: UserMessage) =>
      Effect.suspend(() => {
        if (!started) firstTurn = { message: message.text, error: null }
        started = true
        return harness.send(message)
      }).pipe(Effect.catchTag("HarnessError", fail))

    const run: AgentRun = {
      cwd: session.workingFolder,
      options,
      busy: () => busy,
      turn: () => turn,
      hasTasks: writer.hasOpenTasks,
      taskOutput: (taskId) =>
        Effect.suspend(() => {
          const path = taskFiles.get(taskId)
          return path === undefined ? Effect.succeed(null) : provider.readTaskOutput(path)
        }),
      stopTask: harness.stopTask,
      record: (event) => writer.record(event),
      start: (message) =>
        Effect.gen(function* () {
          // Mid-turn, a worktree the agent just made would be taken for one that was already there.
          if (!busy) yield* follower.turnStarted
          yield* writer.record(userMessageEvent(message), message.id)
          yield* send(message)
        }),
      steer: send,
      answer: (answer) =>
        writer
          .decide(answer)
          .pipe(
            Effect.tap((open) =>
              open
                ? harness.respond(answer).pipe(Effect.catchTag("HarnessError", fail))
                : Effect.void,
            ),
          ),
      interrupt: harness.interrupt,
      end,
      stop,
      stopInterrupted: guarded(
        "record interruption",
        writer.record({ type: "interruption", raw: null }),
      ).pipe(Effect.andThen(stop)),
      fail,
    }

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
    const endedTask = (output: Extract<HarnessOutput, { type: "task_ended" }>) =>
      Effect.gen(function* () {
        const task = writer.openTask(output.taskId)
        // A notification for a task this run never listed, such as a foreground subagent.
        if (task === undefined) return
        const path = taskFiles.get(output.taskId)
        taskFiles.delete(output.taskId)
        const final =
          task.kind === "command" && path !== undefined
            ? yield* provider.readTaskOutput(path)
            : null
        yield* writer.record({ ...output, output: final })
        yield* writer.afterTaskEnded(busy)
      })
    const handle = (output: HarnessOutput) => {
      if (output.type === "delta") return writer.stream(output)
      if (output.type === "task_output_file") {
        taskFiles.set(output.taskId, output.path)
        return Effect.void
      }
      if (output.type === "task_ended") return endedTask(output)
      // Steps of a subagent the turn waits for are the tool call's own business, not a task's.
      if ("parentToolCallId" in output && output.parentToolCallId !== undefined) {
        return writer.runsTask(output.parentToolCallId) ? writer.record(output) : Effect.void
      }
      if (output.type === "task_started") {
        return writer.record(output).pipe(Effect.andThen(writer.afterTaskStarted(busy)))
      }
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
        Effect.andThen(output.type === "status" ? writer.turnStatus(output.status) : Effect.void),
        Effect.andThen(follower.observe(output)),
        Effect.andThen(turnEnded ? hooks.turnEnded(run) : Effect.void),
      )
    }

    // The run's only exit path: it must never take the session lock, which `stop` holds while closing the run.
    yield* Stream.runForEach(harness.events, handle).pipe(
      Effect.onExit((exit) => {
        if (Exit.isSuccess(exit)) {
          return stop
        }
        // The scope closing, which `end` already does, interrupts this fiber.
        if (Cause.hasInterruptsOnly(exit.cause)) return Effect.void
        const failure = Cause.findErrorOption(exit.cause)
        const error = Option.isSome(failure) ? failure.value : runFailed
        return Effect.suspend(() => {
          if (firstTurn !== null) firstTurn.error ??= error.message
          return Option.isNone(failure)
            ? logError("harness run", Cause.squash(exit.cause))
            : Effect.void
        }).pipe(
          Effect.andThen(guarded("end first turn", endFirstTurn)),
          Effect.andThen(fail(error)),
        )
      }),
      Effect.forkIn(scope),
    )

    return run
  })
