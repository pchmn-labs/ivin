import { Cause, Effect } from "effect"

export const logError = (action: string, error: unknown) =>
  Effect.logError(error).pipe(Effect.annotateLogs({ source: "server", action }))

export const logFailure = (action: string, cause: Cause.Cause<unknown>) =>
  Cause.hasInterruptsOnly(cause) ? Effect.void : logError(action, Cause.squash(cause))
