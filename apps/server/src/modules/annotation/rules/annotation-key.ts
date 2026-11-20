import type { Json } from "effect/Schema"
import * as Schema from "effect/Schema"

export interface KindDefinition {
  readonly data: Schema.Top
  readonly key: string
}

// `invalid` when the data does not match its kind's definition; a kind with none has no key.
export const annotationKey = (
  definition: KindDefinition | undefined,
  data: Json,
): { readonly key: string | null } | "invalid" => {
  if (definition === undefined) return { key: null }
  if (!Schema.is(definition.data)(data)) return "invalid"
  return { key: String((data as Record<string, unknown>)[definition.key]) }
}
