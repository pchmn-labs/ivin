import { Effect, Exit, Layer, PubSub, Scope, Stream } from "effect"
import { expect, test } from "vitest"
import { FolderWatcher } from "./folder-watcher.ts"
import { layerSharedFolderWatch, SharedFolderWatch } from "./shared-folder-watch.ts"

// A watcher that counts the folders it opened and closed, and emits what the test publishes.
const makeFake = () => {
  const log = { opened: [] as string[], closed: [] as string[] }
  const source = Effect.runSync(PubSub.unbounded<string>())
  const layer = Layer.succeed(FolderWatcher)({
    open: (folder) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          log.opened.push(folder)
        }),
        () => Effect.sync(() => void log.closed.push(folder)),
      ).pipe(
        Effect.andThen(PubSub.subscribe(source)),
        Effect.map((subscription) => Stream.fromSubscription(subscription)),
      ),
  })
  return { log, source, layer: layerSharedFolderWatch.pipe(Layer.provide(layer)) }
}

const run = <A, E>(
  fake: ReturnType<typeof makeFake>,
  program: Effect.Effect<A, E, SharedFolderWatch | Scope.Scope>,
) => Effect.runPromise(program.pipe(Effect.provide(fake.layer), Effect.scoped))

test("readers of one folder share a watcher, which closes with the last reader", async () => {
  const fake = makeFake()
  await run(
    fake,
    Effect.gen(function* () {
      const watches = yield* SharedFolderWatch
      const first = yield* Scope.make()
      const second = yield* Scope.make()
      yield* watches.subscribe("/repo").pipe(Scope.provide(first))
      yield* watches.subscribe("/repo").pipe(Scope.provide(second))
      expect(fake.log).toEqual({ opened: ["/repo"], closed: [] })

      yield* Scope.close(first, Exit.void)
      expect(fake.log.closed).toEqual([])
      yield* Scope.close(second, Exit.void)
      expect(fake.log.closed).toEqual(["/repo"])
    }),
  )
})

test("a reader after the last one left opens a new watcher, and each folder has its own", async () => {
  const fake = makeFake()
  await run(
    fake,
    Effect.gen(function* () {
      const watches = yield* SharedFolderWatch
      const first = yield* Scope.make()
      yield* watches.subscribe("/repo").pipe(Scope.provide(first))
      yield* Scope.close(first, Exit.void)
      yield* watches.subscribe("/repo")
      yield* watches.subscribe("/other")
      expect(fake.log.opened).toEqual(["/repo", "/repo", "/other"])
    }),
  )
})

test("every reader gets the paths the watcher reports", async () => {
  const fake = makeFake()
  const [a, b] = await run(
    fake,
    Effect.gen(function* () {
      const watches = yield* SharedFolderWatch
      const one = yield* watches.subscribe("/repo")
      const two = yield* watches.subscribe("/repo")
      yield* PubSub.publish(fake.source, "src/a.ts")
      yield* PubSub.publish(fake.source, "b.ts")
      return yield* Effect.all([
        one.pipe(Stream.take(2), Stream.runCollect),
        two.pipe(Stream.take(2), Stream.runCollect),
      ])
    }),
  )
  expect([a, b]).toEqual([
    ["src/a.ts", "b.ts"],
    ["src/a.ts", "b.ts"],
  ])
})
