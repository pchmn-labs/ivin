import type { AnnotationTarget } from "@ivin/contracts/annotation"
import { Effect } from "effect"
import { AnnotationStore } from "./annotation-store.ts"

export const listAnnotations = (target: AnnotationTarget, kind: string | null) =>
  Effect.gen(function* () {
    return yield* (yield* AnnotationStore).list(target, kind)
  })
