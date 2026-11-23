import type { AnnotationChange, AnnotationTarget } from "@ivin/contracts/annotation"
import { Effect, Stream } from "effect"
import { AnnotationStore } from "./annotation-store.ts"
import { AnnotationFeed } from "./annotation-feed.ts"
import { listAnnotations } from "./list-annotations.ts"

export const watchAnnotations = (target: AnnotationTarget) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const current = listAnnotations(target, null).pipe(
        Effect.map((annotations) =>
          annotations.map((annotation): AnnotationChange => ({ _tag: "changed", annotation })),
        ),
      )
      const context = yield* Effect.context<AnnotationStore>()
      const changes = yield* (yield* AnnotationFeed).watch(target, Effect.provide(current, context))
      return Stream.fromIterable(yield* current).pipe(Stream.concat(changes))
    }),
  )
