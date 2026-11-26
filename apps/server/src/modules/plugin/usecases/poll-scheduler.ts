import { Clock, Effect, Fiber, Option, type Scope, Stream, SubscriptionRef } from "effect"

const STALE_AFTER = 15_000

interface Registrant {
  readonly plugin: string
  every: number
}

interface Poll {
  readonly registrants: Registrant[]
  readonly fiber: Fiber.Fiber<void>
}

export interface PollScheduler {
  // The first plugin to register a key runs it; the others take over when it stops.
  readonly register: (plugin: string, key: string, every: number) => Effect.Effect<void>
  readonly stop: (plugin: string, key: string) => Effect.Effect<void>
  readonly stopPlugin: (plugin: string) => Effect.Effect<void>
}

// `run` returns the plugin's new interval when its function changed it.
export const makePollScheduler = (
  visible: SubscriptionRef.SubscriptionRef<boolean>,
  run: (plugin: string, key: string) => Effect.Effect<number | null>,
): Effect.Effect<PollScheduler, never, Scope.Scope> =>
  Effect.gen(function* () {
    const polls = new Map<string, Poll>()
    const scope = yield* Effect.scope
    const untilVisible = SubscriptionRef.changes(visible).pipe(
      Stream.filter((isVisible) => isVisible),
      Stream.take(1),
      Stream.runDrain,
    )
    const loop = (key: string, registrants: Registrant[]) =>
      Effect.gen(function* () {
        while (true) {
          yield* untilVisible
          const owner = registrants[0]
          if (owner === undefined) return
          const startedAt = yield* Clock.currentTimeMillis
          const next = yield* run(owner.plugin, key)
          if (next !== null && next > 0) owner.every = next
          const shownAgain = SubscriptionRef.changes(visible).pipe(
            Stream.zipWithPrevious,
            Stream.filter(([before, now]) => now && Option.getOrNull(before) === false),
            Stream.mapEffect(() => Clock.currentTimeMillis),
            Stream.filter((now) => now - startedAt > STALE_AFTER),
            Stream.take(1),
            Stream.runDrain,
          )
          yield* Effect.race(Effect.sleep(registrants[0]?.every ?? owner.every), shownAgain)
        }
      })
    const stopKey = (key: string, poll: Poll) =>
      Effect.sync(() => polls.delete(key)).pipe(Effect.andThen(Fiber.interrupt(poll.fiber)))
    const stopFor = (plugin: string, key: string) =>
      Effect.suspend(() => {
        const poll = polls.get(key)
        if (poll === undefined) return Effect.void
        const index = poll.registrants.findIndex((r) => r.plugin === plugin)
        if (index >= 0) poll.registrants.splice(index, 1)
        return poll.registrants.length === 0 ? stopKey(key, poll) : Effect.void
      })
    return {
      register: (plugin, key, every) =>
        Effect.gen(function* () {
          const existing = polls.get(key)
          if (existing !== undefined) {
            if (!existing.registrants.some((r) => r.plugin === plugin)) {
              existing.registrants.push({ plugin, every })
            }
            return
          }
          const registrants: Registrant[] = [{ plugin, every }]
          const fiber = yield* Effect.forkIn(loop(key, registrants), scope)
          polls.set(key, { registrants, fiber })
        }),
      stop: (plugin, key) => stopFor(plugin, key),
      stopPlugin: (plugin) =>
        Effect.forEach([...polls.keys()], (key) => stopFor(plugin, key), { discard: true }),
    }
  })
