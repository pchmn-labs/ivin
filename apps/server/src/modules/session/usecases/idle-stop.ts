import { Duration, Effect, Fiber } from "effect"
import type { AgentRun } from "./agent-run.ts"
import { SessionStore } from "./session-store.ts"
import type { TranscriptWriter } from "./transcript-writer.ts"

// Runs `effect` after `delay`, under the session's lock, if `run` is still the session's run.
type Later = (
  delay: Duration.Input,
  sessionId: string,
  run: AgentRun,
  effect: Effect.Effect<void>,
) => Effect.Effect<Fiber.Fiber<void>>

export const makeIdleStop = (idleLimit: Effect.Effect<Duration.Input>, later: Later) =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore
    const timers = new Map<AgentRun, Fiber.Fiber<void>>()

    const cancel = (run: AgentRun) =>
      Effect.suspend(() => {
        const timer = timers.get(run)
        timers.delete(run)
        return timer === undefined ? Effect.void : Fiber.interrupt(timer)
      })

    const start = (
      sessionId: string,
      run: AgentRun,
      writer: TranscriptWriter,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* cancel(run)
        const limit = Duration.fromInputUnsafe(yield* idleLimit)
        if (Duration.isZero(limit)) return
        const idleTurn = run.turn()
        const timer = yield* later(
          limit,
          sessionId,
          run,
          Effect.gen(function* () {
            // This fiber is about to stop or re-arm the run, which must not interrupt it.
            timers.delete(run)
            if (run.busy() || run.turn() !== idleTurn) return
            const pending = yield* sessions.pendingMessages(sessionId)
            // Re-checked after another limit: none of them ends with a turn of its own.
            if (pending.length > 0 || writer.hasOpenRequests() || writer.hasOpenTasks()) {
              return yield* start(sessionId, run, writer)
            }
            yield* run.stop
          }),
        )
        timers.set(run, timer)
      })

    return { start, cancel }
  })
