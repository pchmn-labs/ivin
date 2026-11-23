import { Deferred, Effect, Fiber, Stream } from "effect"
import { expect } from "vitest"

// Runs `collect` over `stream` in a child fiber and returns it once the stream's first value
// arrived: the watch handlers subscribe before reading that value, so later changes are not missed.
export const forkWatch = <A, E, R, B, E2, R2>(
  stream: Stream.Stream<A, E, R>,
  collect: (stream: Stream.Stream<A, E, R>) => Effect.Effect<B, E2, R2>,
) =>
  Effect.gen(function* () {
    const subscribed = yield* Deferred.make<void>()
    const fiber = yield* collect(
      stream.pipe(Stream.tap(() => Deferred.succeed(subscribed, undefined))),
    ).pipe(Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(subscribed), Fiber.join(fiber).pipe(Effect.asVoid))
    return fiber
  })

export const until = <A, E>(
  read: Effect.Effect<A, E>,
  done: (value: A) => boolean,
  timeout = 10_000,
) =>
  Effect.promise(async () => {
    let last: A | undefined
    await expect
      .poll(
        async () => {
          last = await Effect.runPromise(read)
          return done(last)
        },
        { timeout, interval: 5 },
      )
      .toBe(true)
    return last as A
  })
