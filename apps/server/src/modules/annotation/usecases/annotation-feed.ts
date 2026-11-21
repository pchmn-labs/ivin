import type { AnnotationChange, AnnotationTarget } from "@ivin/contracts/annotation"
import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"

const FEED_CAPACITY = 256

const targetOf = (change: AnnotationChange) =>
  change._tag === "changed" ? change.annotation.target : change.target

export const sameTarget = (a: AnnotationTarget, b: AnnotationTarget) =>
  a._tag === "session"
    ? b._tag === "session" && a.sessionId === b.sessionId
    : b._tag === "project" && a.projectPath === b.projectPath

export class AnnotationFeed extends Context.Service<
  AnnotationFeed,
  {
    readonly publish: (change: AnnotationChange) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed.
    readonly watch: (
      target: AnnotationTarget,
    ) => Effect.Effect<Stream.Stream<AnnotationChange>, never, Scope.Scope>
  }
>()("ivin/server/AnnotationFeed") {}

export const layerAnnotationFeed = Layer.effect(AnnotationFeed)(
  Effect.gen(function* () {
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<AnnotationChange>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    return {
      publish: (change) => PubSub.publish(pubsub, change).pipe(Effect.asVoid),
      watch: (target) =>
        PubSub.subscribe(pubsub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((change) => sameTarget(targetOf(change), target)),
            ),
          ),
        ),
    }
  }),
)
