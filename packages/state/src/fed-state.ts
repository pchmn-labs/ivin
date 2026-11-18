import { Effect } from "effect"
import { Atom, AtomRegistry, type AsyncResult } from "effect/reactivity"

export interface FedState<A> {
  readonly value: Atom.Atom<A>
  readonly status: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
  readonly set: (next: A) => Effect.Effect<void, never, AtomRegistry.AtomRegistry>
  readonly get: Effect.Effect<A, never, AtomRegistry.AtomRegistry>
}

// A value loaded once while something reads it, then written by mutations; a write made before the load ends wins.
export const makeFedState = <A, R, ER, E>(options: {
  readonly initial: A
  readonly runtime: Atom.AtomRuntime<R, ER>
  readonly load: Effect.Effect<A, E, R | AtomRegistry.AtomRegistry>
}): FedState<A> => {
  const state = Atom.keepAlive(Atom.make<A | null>(null))
  const feed = options.runtime.atom(
    Effect.yieldNow.pipe(
      Effect.andThen(options.load),
      Effect.andThen((loaded) => Atom.update(state, (current) => current ?? loaded)),
    ),
  )
  const live = Atom.readable((get) => {
    get(feed)
  })
  const value = Atom.readable((get) => {
    get(live)
    return get(state) ?? options.initial
  })
  return {
    value,
    status: feed,
    set: (next) => Atom.set(state, next),
    get: Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry
      return registry.get(state) ?? options.initial
    }),
  }
}
