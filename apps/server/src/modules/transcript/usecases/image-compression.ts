import { Context, Effect, FiberSet, Layer, Semaphore } from "effect"
import { logFailure } from "../../log/usecases/log-error.ts"
import { ImageStore } from "./image-store.ts"

export class ImageCompression extends Context.Service<
  ImageCompression,
  {
    // Returns at once: compressing must not hold the tab's closing.
    readonly afterTabsClosed: (sessionIds: readonly string[]) => Effect.Effect<void>
    // Waits for the compressions started so far.
    readonly settled: Effect.Effect<void>
  }
>()("ivin/server/ImageCompression") {}

const compressSession = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* ImageStore
    for (const imageId of yield* store.uncompressed(sessionId)) {
      yield* store
        .compress(sessionId, imageId)
        .pipe(Effect.catchCause((cause) => logFailure("image compression", cause)))
    }
  })

export const layerImageCompression = Layer.effect(ImageCompression)(
  Effect.gen(function* () {
    const context = yield* Effect.context<ImageStore>()
    const fibers = yield* FiberSet.make()
    // One pass at a time, so two never compress the same image.
    const passes = yield* Semaphore.make(1)
    return {
      afterTabsClosed: (sessionIds) =>
        FiberSet.run(
          fibers,
          passes
            .withPermits(1)(Effect.forEach(sessionIds, compressSession, { discard: true }))
            .pipe(Effect.provideContext(context)),
        ).pipe(Effect.asVoid),
      settled: FiberSet.awaitEmpty(fibers),
    }
  }),
)
