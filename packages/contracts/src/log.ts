import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const ErrorReport = Schema.Struct({
  action: Schema.String,
  type: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String),
})
export type ErrorReport = typeof ErrorReport.Type

export const LogRpcs = RpcGroup.make(Rpc.make("log.writeError", { payload: ErrorReport }))
