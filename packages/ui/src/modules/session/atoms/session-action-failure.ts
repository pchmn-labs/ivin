import { Cause, Effect } from "effect"
import { Atom, type AtomRegistry } from "effect/reactivity"
import { sessionActionFailure, type SessionAction } from "../rules/session-action-failure.ts"

// The last failed archive, restore or delete of the session, shown next to its row.
export const sessionActionFailureOf = Atom.family((_sessionId: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

// How many mounted components show the session's failure: with none, it has no place on screen.
export const sessionActionFailureShownBy = Atom.family((_sessionId: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
)

// Clears the session's last failure, then records this action's, if it fails.
export const recordingFailure =
  (action: SessionAction, sessionId: string) =>
  <A, E, R>(
    run: Effect.Effect<A, E, R>,
  ): Effect.Effect<void, never, R | AtomRegistry.AtomRegistry> =>
    Atom.set(sessionActionFailureOf(sessionId), null).pipe(
      Effect.andThen(run),
      Effect.asVoid,
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.void
          : Atom.set(
              sessionActionFailureOf(sessionId),
              sessionActionFailure(action, Cause.squash(cause)),
            ),
      ),
    )
