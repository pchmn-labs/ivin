import type { Annotation, AnnotationTarget } from "@ivin/contracts/annotation"
import { Context, type Effect } from "effect"

export class AnnotationStore extends Context.Service<
  AnnotationStore,
  {
    readonly find: (id: string) => Effect.Effect<Annotation | null>
    readonly list: (
      target: AnnotationTarget,
      kind: string | null,
    ) => Effect.Effect<readonly Annotation[]>
    // With a key, updates the target's annotation of the same ns, kind and key, keeping its id.
    readonly save: (annotation: Annotation, key: string | null) => Effect.Effect<Annotation>
    readonly remove: (id: string) => Effect.Effect<void>
    readonly removeByTarget: (target: AnnotationTarget) => Effect.Effect<void>
  }
>()("ivin/server/AnnotationStore") {}
