import {
  type Annotation,
  AnnotationDataInvalid,
  annotationKinds,
  type AnnotationTarget,
} from "@ivin/contracts/annotation"
import { ProjectNotFound } from "@ivin/contracts/project"
import { SessionNotFound } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import type { Json } from "effect/Schema"
import { annotationKey, type KindDefinition } from "../rules/annotation-key.ts"
import { AnnotationFeed } from "./annotation-feed.ts"
import { AnnotationStore } from "./annotation-store.ts"

const definitionOf = (kind: string): KindDefinition | undefined =>
  Object.hasOwn(annotationKinds, kind)
    ? annotationKinds[kind as keyof typeof annotationKinds]
    : undefined

const ensureTarget = (target: AnnotationTarget) =>
  Effect.gen(function* () {
    if (yield* (yield* AnnotationStore).targetExists(target)) return
    return yield* target._tag === "session"
      ? Effect.fail(new SessionNotFound({ sessionId: target.sessionId }))
      : Effect.fail(new ProjectNotFound({ path: target.projectPath }))
  })

export const addAnnotation = (target: AnnotationTarget, ns: string, kind: string, data: Json) =>
  Effect.gen(function* () {
    yield* ensureTarget(target)
    const keyed = annotationKey(definitionOf(kind), data)
    if (keyed === "invalid") return yield* new AnnotationDataInvalid({ kind })
    const now = yield* DateTime.now
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      target,
      ns,
      kind,
      data,
      createdAt: now,
      updatedAt: now,
    }
    const saved = yield* (yield* AnnotationStore).save(annotation, keyed.key)
    yield* (yield* AnnotationFeed).publish({ _tag: "changed", annotation: saved })
    return saved
  })
