import { Effect, Stream } from "effect"
import { expect, test } from "vitest"
import { makeWatcherFeed } from "./watcher-feed.ts"

type Change = { readonly owner: string; readonly value: number; readonly removal?: boolean }

const feed = () =>
  makeWatcherFeed<string, Change>({
    capacity: 3,
    matches: (key, change) => change.owner === key,
    isRemoval: (change) => change.removal === true,
  })

const take = (stream: Stream.Stream<Change>, count: number) =>
  stream.pipe(Stream.take(count), Stream.runCollect)

test("a watcher that keeps up gets every change it watches, in order", async () => {
  const changes = feed()

  const received = await Effect.runPromise(
    Effect.gen(function* () {
      const stream = yield* changes.watch("a", Effect.succeed([]))
      for (const value of [1, 2, 3]) yield* changes.publish({ owner: "a", value })
      return yield* take(stream, 3)
    }).pipe(Effect.scoped),
  )

  expect(received.map((change) => change.value)).toEqual([1, 2, 3])
})

test("changes for other keys do not push out a watcher's own", async () => {
  const changes = feed()

  const received = await Effect.runPromise(
    Effect.gen(function* () {
      const stream = yield* changes.watch("a", Effect.die("must not be read"))
      yield* changes.publish({ owner: "a", value: 1 })
      for (let value = 0; value < 50; value++) yield* changes.publish({ owner: "b", value })
      yield* changes.publish({ owner: "a", value: 2 })
      return yield* take(stream, 2)
    }).pipe(Effect.scoped),
  )

  expect(received.map((change) => change.value)).toEqual([1, 2])
})

test("a watcher whose buffer overflowed gets the current state and the removals it missed, then carries on", async () => {
  const changes = feed()
  const current = Effect.succeed([{ owner: "a", value: 100 }])

  const received = await Effect.runPromise(
    Effect.gen(function* () {
      const stream = yield* changes.watch("a", current)
      yield* changes.publish({ owner: "a", value: 1, removal: true })
      for (const value of [2, 3, 4, 5]) yield* changes.publish({ owner: "a", value })
      yield* changes.publish({ owner: "a", value: 6, removal: true })
      const resent = yield* stream.pipe(Stream.take(3), Stream.runCollect)
      yield* changes.publish({ owner: "a", value: 7 })
      const next = yield* stream.pipe(Stream.take(1), Stream.runCollect)
      return [...resent, ...next]
    }).pipe(Effect.scoped),
  )

  expect(received.map((change) => change.value)).toEqual([1, 6, 100, 7])
})
