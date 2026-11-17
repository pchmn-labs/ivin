import { Effect } from "effect"
import type { AtomRegistry } from "effect/reactivity"

type Step<R = never> = Effect.Effect<void, never, AtomRegistry.AtomRegistry | R>

// Applies `apply` at once, runs the server call, then `reconcile`s with its answer or `rollback`s on failure or interruption.
export const optimistic =
  <A>(update: {
    readonly apply: Step
    readonly rollback: Step
    readonly reconcile?: (answer: A) => Step
  }) =>
  <E, R>(run: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | AtomRegistry.AtomRegistry> =>
    Effect.andThen(update.apply, run).pipe(
      Effect.tap((answer) => update.reconcile?.(answer) ?? Effect.void),
      Effect.onError(() => update.rollback),
    )
