import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { ProjectNotFound } from "./project.ts"
import { SessionNotFound } from "./session.ts"

export const AnnotationTarget = Schema.Union([
  Schema.TaggedStruct("session", { sessionId: Schema.String }),
  Schema.TaggedStruct("project", { projectPath: Schema.String }),
])
export type AnnotationTarget = typeof AnnotationTarget.Type

export const PrAnnotationData = Schema.Struct({
  url: Schema.String,
  relation: Schema.Literals(["created", "referenced"]),
})
export type PrAnnotationData = typeof PrAnnotationData.Type

// The kinds shared by several plugins, each with the data field that is its key.
export const annotationKinds = {
  pr: { data: PrAnnotationData, key: "url" },
} as const
export type AnnotationKinds = typeof annotationKinds
export type AnnotationDataOf<K extends string> = K extends keyof AnnotationKinds
  ? AnnotationKinds[K]["data"]["Type"]
  : Schema.Json

export const Annotation = Schema.Struct({
  id: Schema.String,
  target: AnnotationTarget,
  ns: Schema.String,
  kind: Schema.String,
  data: Schema.Json,
  createdAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
})
export type Annotation = typeof Annotation.Type

export const AnnotationChange = Schema.Union([
  Schema.TaggedStruct("changed", { annotation: Annotation }),
  Schema.TaggedStruct("removed", { id: Schema.String, target: AnnotationTarget }),
])
export type AnnotationChange = typeof AnnotationChange.Type

export class AnnotationNotFound extends Schema.TaggedError<AnnotationNotFound>()(
  "AnnotationNotFound",
  { id: Schema.String },
) {}

export class AnnotationDataInvalid extends Schema.TaggedError<AnnotationDataInvalid>()(
  "AnnotationDataInvalid",
  { kind: Schema.String },
) {}

export const AnnotationRpcs = RpcGroup.make(
  Rpc.make("annotation.add", {
    payload: {
      target: AnnotationTarget,
      ns: Schema.String,
      kind: Schema.String,
      data: Schema.Json,
    },
    success: Annotation,
    error: Schema.Union([SessionNotFound, ProjectNotFound, AnnotationDataInvalid]),
  }),
  Rpc.make("annotation.remove", {
    payload: { id: Schema.String },
    error: AnnotationNotFound,
  }),
  // Oldest first; every kind when `kind` is null.
  Rpc.make("annotation.list", {
    payload: { target: AnnotationTarget, kind: Schema.NullOr(Schema.String) },
    success: Schema.Array(Annotation),
  }),
  // The target's annotations as `changed`, then each change.
  Rpc.make("annotation.watch", {
    payload: { target: AnnotationTarget },
    success: AnnotationChange,
    stream: true,
  }),
)
