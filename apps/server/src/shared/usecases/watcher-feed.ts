import { Effect, Queue, type Scope, Stream } from "effect"

interface Watcher<Key, Change> {
  readonly key: Key
  readonly queue: Queue.Queue<Change | typeof Overflowed>
  overflowed: boolean
  // Removals published since the buffer overflowed, which the current state cannot show.
  removed: Change[]
}

const Overflowed = Symbol("overflowed")

export interface WatcherFeed<Key, Change> {
  readonly publish: (change: Change) => Effect.Effect<void>
  // Subscribed on return: nothing published afterwards is missed. A watcher whose buffer
  // overflowed gets `current` again, after the removals it missed, then carries on.
  readonly watch: (
    key: Key,
    current: Effect.Effect<readonly Change[]>,
  ) => Effect.Effect<Stream.Stream<Change>, never, Scope.Scope>
}

// One bounded buffer per watcher, filtered on publish, so a slow watcher never stalls the writer
// and other watchers' changes never push out its own.
export const makeWatcherFeed = <Key, Change>(options: {
  readonly capacity: number
  readonly matches: (key: Key, change: Change) => boolean
  readonly isRemoval?: (change: Change) => boolean
}): WatcherFeed<Key, Change> => {
  const watchers = new Set<Watcher<Key, Change>>()
  const isRemoval = options.isRemoval ?? (() => false)

  const deliver = (watcher: Watcher<Key, Change>, change: Change) =>
    Effect.gen(function* () {
      if (watcher.overflowed) {
        if (isRemoval(change)) watcher.removed.push(change)
        return
      }
      if (Queue.offerUnsafe(watcher.queue, change)) return
      const dropped = yield* Queue.clear(watcher.queue)
      watcher.overflowed = true
      watcher.removed = [...dropped, change].filter(
        (entry): entry is Change => entry !== Overflowed && isRemoval(entry),
      )
      Queue.offerUnsafe(watcher.queue, Overflowed)
    })

  return {
    publish: (change) =>
      Effect.forEach(
        [...watchers].filter((watcher) => options.matches(watcher.key, change)),
        (watcher) => deliver(watcher, change),
        { discard: true },
      ),
    watch: (key, current) =>
      Effect.acquireRelease(
        Effect.gen(function* () {
          const watcher: Watcher<Key, Change> = {
            key,
            queue: yield* Queue.bounded<Change | typeof Overflowed>(options.capacity + 1),
            overflowed: false,
            removed: [],
          }
          watchers.add(watcher)
          return watcher
        }),
        (watcher) =>
          Effect.suspend(() => {
            watchers.delete(watcher)
            return Queue.shutdown(watcher.queue)
          }),
      ).pipe(
        Effect.map((watcher) =>
          Stream.fromQueue(watcher.queue).pipe(
            Stream.flatMap((entry) =>
              entry === Overflowed
                ? Stream.unwrap(
                    Effect.gen(function* () {
                      // Reset first: what is published while `current` reads arrives twice, never lost.
                      const removed = watcher.removed
                      watcher.removed = []
                      watcher.overflowed = false
                      return Stream.fromIterable([...removed, ...(yield* current)])
                    }),
                  )
                : Stream.succeed(entry),
            ),
          ),
        ),
      ),
  }
}
