import { Schema } from "effect"

// A plugin's `ctx.fetch` as it crosses to the server, which makes the request.
export const PluginFetchRequest = Schema.Struct({
  url: Schema.String,
  method: Schema.String,
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  // Base64; null for a request without a body.
  body: Schema.NullOr(Schema.String),
})
export type PluginFetchRequest = typeof PluginFetchRequest.Type

export const PluginFetchResponse = Schema.Struct({
  // The URL after the redirects.
  url: Schema.String,
  status: Schema.Number,
  statusText: Schema.String,
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  // Base64.
  body: Schema.String,
})
export type PluginFetchResponse = typeof PluginFetchResponse.Type

export class PluginFetchFailed extends Schema.TaggedError<PluginFetchFailed>()(
  "PluginFetchFailed",
  { reason: Schema.String },
) {}
