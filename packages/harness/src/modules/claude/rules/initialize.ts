import type { OfferedModel } from "@ivin/contracts/session"
import * as Schema from "effect/Schema"

const ControlResponse = Schema.Struct({
  type: Schema.Literal("control_response"),
  response: Schema.Struct({
    subtype: Schema.String,
    request_id: Schema.String,
    response: Schema.optional(Schema.Unknown),
  }),
})

const ModelEntry = Schema.Struct({
  value: Schema.String,
  displayName: Schema.String,
  description: Schema.optional(Schema.String),
  supportedEffortLevels: Schema.optional(Schema.Array(Schema.String)),
})

const ModelList = Schema.Struct({ models: Schema.Array(Schema.Unknown) })

// Same as what the CLI picks without --model, which a session never relies on.
const DEFAULT_ENTRY = "default"

export const initializeRequestLine = (requestId: string) =>
  JSON.stringify({
    type: "control_request",
    request_id: requestId,
    request: { subtype: "initialize" },
  })

const toModel = (entry: unknown): OfferedModel[] => {
  const decoded = Schema.decodeUnknownOption(ModelEntry)(entry)
  if (decoded._tag === "None" || decoded.value.value === DEFAULT_ENTRY) return []
  const { value, displayName, description, supportedEffortLevels } = decoded.value
  return [
    {
      value,
      name: displayName,
      description: description ?? null,
      efforts: supportedEffortLevels ?? [],
      // An alias follows the latest release; a full model id pins an earlier one.
      older: value.startsWith("claude-"),
    },
  ]
}

// Undefined: the line is not the response to `requestId`.
export const modelsFromInitialize = (
  line: unknown,
  requestId: string,
): OfferedModel[] | undefined => {
  const control = Schema.decodeUnknownOption(ControlResponse)(line)
  if (control._tag === "None" || control.value.response.request_id !== requestId) return undefined
  const list = Schema.decodeUnknownOption(ModelList)(control.value.response.response)
  if (list._tag === "None") return []
  const models = list.value.models.flatMap(toModel)
  return [...models.filter((model) => !model.older), ...models.filter((model) => model.older)]
}
