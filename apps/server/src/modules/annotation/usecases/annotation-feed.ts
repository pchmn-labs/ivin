import type { AnnotationChange, AnnotationTarget } from "@ivin/contracts/annotation"
import { Context, type Effect, Layer, type Scope, type Stream } from "effect"
import { makeWatcherFeed } from "../../../shared/usecases/watcher-feed.ts"

const WATCHER_BUFFER = 256

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
    // Subscribed on return: nothing published afterwards is missed. A watcher that falls
    // behind gets the removals it missed, then `current` again.
    readonly watch: (
      target: AnnotationTarget,
      current: Effect.Effect<readonly AnnotationChange[]>,
    ) => Effect.Effect<Stream.Stream<AnnotationChange>, never, Scope.Scope>
  }
>()("ivin/server/AnnotationFeed") {}

export const layerAnnotationFeed = Layer.sync(AnnotationFeed)(() => {
  const feed = makeWatcherFeed<AnnotationTarget, AnnotationChange>({
    capacity: WATCHER_BUFFER,
    matches: (target, change) => sameTarget(targetOf(change), target),
    isRemoval: (change) => change._tag === "removed",
  })
  return { publish: feed.publish, watch: feed.watch }
})
