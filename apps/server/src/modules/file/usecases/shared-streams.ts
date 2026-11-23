import { Effect, Exit, PubSub, Scope, Semaphore, Stream } from "effect"

interface Shared<A> {
  readers: number
  ended: boolean
  // null ends the stream.
  readonly items: PubSub.PubSub<A | null>
  readonly scope: Scope.Closeable
}

// One stream per key, opened with the first reader and closed with the last; it ends for every
// reader when it fails.
export const makeSharedStreams = <A, E>(
  open: (key: string) => Effect.Effect<Stream.Stream<A, unknown>, E, Scope.Scope>,
) => {
  const streams = new Map<string, Shared<A>>()
  const lock = Semaphore.makeUnsafe(1)

  const start = (key: string) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const items = yield* PubSub.unbounded<A | null>()
      const source = yield* open(key).pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.onError(() => Scope.close(scope, Exit.void)),
      )
      const shared: Shared<A> = { readers: 0, ended: false, items, scope }
      yield* Stream.runForEach(source, (item) => PubSub.publish(items, item)).pipe(
        Effect.catch((error) => Effect.logWarning(`stopped reading ${key}`, error)),
        Effect.ensuring(
          Effect.suspend(() => {
            shared.ended = true
            if (streams.get(key) === shared) streams.delete(key)
            return PubSub.publish(items, null)
          }),
        ),
        Effect.forkIn(scope),
      )
      return shared
    })

  const release = (key: string, shared: Shared<A>) =>
    lock.withPermits(1)(
      Effect.suspend(() => {
        if (--shared.readers > 0) return Effect.void
        if (streams.get(key) === shared) streams.delete(key)
        return Scope.close(shared.scope, Exit.void)
      }),
    )

  return {
    subscribe: (key: string): Effect.Effect<Stream.Stream<A>, E, Scope.Scope> =>
      lock.withPermits(1)(
        Effect.gen(function* () {
          let shared = streams.get(key)
          if (shared === undefined) {
            shared = yield* start(key)
            streams.set(key, shared)
          }
          const joined = shared
          joined.readers++
          yield* Effect.addFinalizer(() => release(key, joined))
          const subscription = yield* PubSub.subscribe(joined.items)
          if (joined.ended) return Stream.empty
          return Stream.fromSubscription(subscription).pipe(
            Stream.takeWhile((item): item is A => item !== null),
          )
        }),
      ),
  }
}
