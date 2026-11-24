import { Schema } from "effect"

export const UpdateFailure = Schema.Literals(["network", "fingerprint", "notWritable"])
export type UpdateFailure = typeof UpdateFailure.Type

const idle = Schema.Struct({ kind: Schema.Literal("idle"), current: Schema.String })
const checking = Schema.Struct({ kind: Schema.Literal("checking"), current: Schema.String })
const downloading = Schema.Struct({
  kind: Schema.Literal("downloading"),
  current: Schema.String,
  version: Schema.String,
  notes: Schema.String,
  url: Schema.String,
  percent: Schema.Int,
})
const ready = Schema.Struct({
  kind: Schema.Literal("ready"),
  current: Schema.String,
  version: Schema.String,
  notes: Schema.String,
  url: Schema.String,
})
const failed = Schema.Struct({
  kind: Schema.Literal("failed"),
  current: Schema.String,
  reason: UpdateFailure,
})

export const UpdateState = Schema.Union([idle, checking, downloading, ready, failed])
export type UpdateState = typeof UpdateState.Type
