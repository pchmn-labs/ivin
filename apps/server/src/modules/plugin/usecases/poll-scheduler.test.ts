import { Effect, SubscriptionRef } from "effect"
import { TestClock } from "effect/testing"
import { expect, test } from "vitest"
import { makePollScheduler } from "./poll-scheduler.ts"

const withScheduler = <A>(
  use: (
    scheduler: Effect.Success<ReturnType<typeof makePollScheduler>>,
    ctl: Ctl,
  ) => Effect.Effect<A>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const visible = yield* SubscriptionRef.make(true)
      const runs: string[] = []
      const scheduler = yield* makePollScheduler(visible, (plugin, key) =>
        Effect.sync(() => {
          runs.push(`${plugin}:${key}`)
          return null
        }),
      )
      return yield* use(scheduler, { visible, runs })
    }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
  )

interface Ctl {
  readonly visible: SubscriptionRef.SubscriptionRef<boolean>
  readonly runs: string[]
}

test("two plugins polling a key run one function per period", () =>
  withScheduler((scheduler, { runs }) =>
    Effect.gen(function* () {
      yield* scheduler.register("a", "pr:1", 1000)
      yield* scheduler.register("b", "pr:1", 1000)
      yield* TestClock.adjust("0 millis")
      yield* TestClock.adjust("2500 millis")
      expect(runs).toEqual(["a:pr:1", "a:pr:1", "a:pr:1"])
    }),
  ))

test("nothing runs while the window is hidden, and it resumes when shown", () =>
  withScheduler((scheduler, { visible, runs }) =>
    Effect.gen(function* () {
      yield* SubscriptionRef.set(visible, false)
      yield* scheduler.register("a", "k", 1000)
      yield* TestClock.adjust("5 seconds")
      expect(runs).toEqual([])
      yield* SubscriptionRef.set(visible, true)
      yield* TestClock.adjust("0 millis")
      expect(runs).toEqual(["a:k"])
    }),
  ))

test("the next plugin takes over a key when its owner stops", () =>
  withScheduler((scheduler, { runs }) =>
    Effect.gen(function* () {
      yield* scheduler.register("a", "k", 1000)
      yield* scheduler.register("b", "k", 1000)
      yield* TestClock.adjust("0 millis")
      yield* scheduler.stopPlugin("a")
      yield* TestClock.adjust("1000 millis")
      expect(runs).toEqual(["a:k", "b:k"])
      yield* scheduler.stopPlugin("b")
      yield* TestClock.adjust("5 seconds")
      expect(runs).toHaveLength(2)
    }),
  ))

test("a stopped poll stops running, and its key stops once no plugin is left on it", () =>
  withScheduler((scheduler, { runs }) =>
    Effect.gen(function* () {
      yield* scheduler.register("a", "k", 1000)
      yield* scheduler.register("b", "k", 1000)
      yield* TestClock.adjust("0 millis")
      yield* scheduler.stop("a", "k")
      yield* TestClock.adjust("1000 millis")
      expect(runs).toEqual(["a:k", "b:k"])
      yield* scheduler.stop("b", "k")
      yield* TestClock.adjust("5 seconds")
      expect(runs).toHaveLength(2)
    }),
  ))

test("a poll runs at once when the window shows again after more than 15 s, not before", () =>
  withScheduler((scheduler, { visible, runs }) =>
    Effect.gen(function* () {
      yield* scheduler.register("a", "k", 600_000)
      yield* TestClock.adjust("0 millis")
      expect(runs).toHaveLength(1)

      yield* SubscriptionRef.set(visible, false)
      yield* TestClock.adjust("10 seconds")
      yield* SubscriptionRef.set(visible, true)
      yield* TestClock.adjust("0 millis")
      expect(runs).toHaveLength(1)

      yield* SubscriptionRef.set(visible, false)
      yield* TestClock.adjust("10 seconds")
      yield* SubscriptionRef.set(visible, true)
      yield* TestClock.adjust("0 millis")
      expect(runs).toHaveLength(2)
    }),
  ))
