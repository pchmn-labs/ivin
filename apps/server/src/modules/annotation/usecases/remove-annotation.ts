import { AnnotationNotFound } from "@ivin/contracts/annotation"
import { Effect } from "effect"
import { AnnotationFeed } from "./annotation-feed.ts"
import { AnnotationStore } from "./annotation-store.ts"

export const removeAnnotation = (id: string) =>
  Effect.gen(function* () {
    const store = yield* AnnotationStore
    const annotation = yield* store.find(id)
    if (!annotation) return yield* new AnnotationNotFound({ id })
    yield* store.remove(id)
    yield* (yield* AnnotationFeed).publish({ _tag: "removed", id, target: annotation.target })
  })
