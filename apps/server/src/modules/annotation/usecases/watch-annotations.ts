import type { AnnotationChange, AnnotationTarget } from "@ivin/contracts/annotation"
import { Effect, Stream } from "effect"
import { AnnotationFeed } from "./annotation-feed.ts"
import { listAnnotations } from "./list-annotations.ts"

export const watchAnnotations = (target: AnnotationTarget) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const changes = yield* (yield* AnnotationFeed).watch(target)
      const current = yield* listAnnotations(target, null)
      return Stream.fromIterable(
        current.map((annotation): AnnotationChange => ({ _tag: "changed", annotation })),
      ).pipe(Stream.concat(changes))
    }),
  )
