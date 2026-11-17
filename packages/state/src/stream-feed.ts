import { Effect, Stream } from "effect"
import type { AtomRegistry } from "effect/reactivity"
import type { EntityWriter } from "./entity-list.ts"

// The stream is opened first so no upsert falls between the page and the stream.
export const feedFromPageAndStream = <A, E1, R1, E2, R2>(
  writer: EntityWriter<A>,
  source: {
    readonly page: Effect.Effect<ReadonlyArray<A>, E1, R1>
    readonly updates: Stream.Stream<A, E2, R2>
  },
): Effect.Effect<void, E1 | E2, R1 | R2 | AtomRegistry.AtomRegistry> =>
  Effect.all(
    [
      source.updates.pipe(Stream.runForEach((item) => writer.upsert([item]))),
      source.page.pipe(Effect.flatMap((items) => writer.upsert(items, { keepExisting: true }))),
    ],
    { concurrency: "unbounded", discard: true },
  )
