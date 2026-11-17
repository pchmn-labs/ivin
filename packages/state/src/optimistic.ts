import { Effect } from "effect"
import type { AtomRegistry } from "effect/reactivity"

type Step<R = never> = Effect.Effect<void, never, AtomRegistry.AtomRegistry | R>

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
