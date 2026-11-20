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
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { annotationKey, type KindDefinition } from "../rules/annotation-key.ts"
import { AnnotationFeed } from "./annotation-feed.ts"
import { AnnotationStore } from "./annotation-store.ts"

const definitionOf = (kind: string): KindDefinition | undefined =>
  Object.hasOwn(annotationKinds, kind)
    ? annotationKinds[kind as keyof typeof annotationKinds]
    : undefined

const ensureTarget = (target: AnnotationTarget) =>
  Effect.gen(function* () {
    if (target._tag === "session") {
      const session = yield* (yield* SessionStore).findById(target.sessionId)
      if (!session) return yield* new SessionNotFound({ sessionId: target.sessionId })
    } else if (!(yield* (yield* ProjectStore).isKnown(target.projectPath))) {
      return yield* new ProjectNotFound({ path: target.projectPath })
    }
  })

export const addAnnotation = (target: AnnotationTarget, ns: string, kind: string, data: Json) =>
  Effect.gen(function* () {
    yield* ensureTarget(target)
    const key = annotationKey(definitionOf(kind), data)
    if (key === "invalid") return yield* new AnnotationDataInvalid({ kind })
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
    const saved = yield* (yield* AnnotationStore).save(annotation, key.key)
    yield* (yield* AnnotationFeed).publish({ _tag: "changed", annotation: saved })
    return saved
  })
