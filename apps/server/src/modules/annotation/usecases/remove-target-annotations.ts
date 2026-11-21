import type { AnnotationTarget } from "@ivin/contracts/annotation"
import { Effect } from "effect"
import { AnnotationFeed } from "./annotation-feed.ts"
import { AnnotationStore } from "./annotation-store.ts"

export const removeTargetAnnotations = (target: AnnotationTarget) =>
  Effect.gen(function* () {
    const store = yield* AnnotationStore
    const feed = yield* AnnotationFeed
    const removed = yield* store.list(target, null)
    yield* store.removeByTarget(target)
    yield* Effect.forEach(removed, ({ id }) => feed.publish({ _tag: "removed", id, target }))
  })
