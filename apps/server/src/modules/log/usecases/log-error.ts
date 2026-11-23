import { Cause, Effect } from "effect"

export const logError = (action: string, error: unknown) =>
  Effect.logError(error).pipe(Effect.annotateLogs({ source: "server", action }))

export const logFailure = (action: string, cause: Cause.Cause<unknown>) =>
  Cause.hasInterruptsOnly(cause) ? Effect.void : logError(action, Cause.squash(cause))

// Logs a failure of one cleanup step so the steps after it still run.
export const guarded = <A, E, R>(action: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : logFailure(action, cause).pipe(Effect.as(undefined)),
    ),
  )
