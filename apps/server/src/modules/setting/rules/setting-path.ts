import { Settings, type SettingValueInvalid } from "@ivin/contracts/setting"
import * as Schema from "effect/Schema"

type Expected = SettingValueInvalid["expected"]

interface Leaf {
  readonly path: string
  readonly is: (value: unknown) => boolean
  readonly expected: Expected
}

const expectedOf = (schema: Schema.Struct.Fields[string], path: string): Expected => {
  switch (schema.ast._tag) {
    case "Boolean":
      return "boolean"
    case "Number":
      return "number"
    case "String":
      return "string"
    default:
      throw new Error(`The setting ${path} has a type settings set cannot check.`)
  }
}

const leavesOf = (fields: Schema.Struct.Fields, prefix: string): Leaf[] =>
  Object.entries(fields).flatMap(([key, schema]) => {
    const path = `${prefix}${key}`
    return "fields" in schema
      ? leavesOf(schema.fields as Schema.Struct.Fields, `${path}.`)
      : [
          {
            path,
            is: Schema.is(schema as Schema.Codec<unknown>),
            expected: expectedOf(schema, path),
          },
        ]
  })

const leaves = new Map(leavesOf(Settings.fields, "").map((leaf) => [leaf.path, leaf]))

export const settingPaths: readonly string[] = [...leaves.keys()]

export const checkSetting = (
  path: string,
  value: unknown,
):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "unknownPath" }
  | { readonly ok: false; readonly reason: "invalidValue"; readonly expected: Expected } => {
  const leaf = leaves.get(path)
  if (leaf === undefined) return { ok: false, reason: "unknownPath" }
  return leaf.is(value)
    ? { ok: true }
    : { ok: false, reason: "invalidValue", expected: leaf.expected }
}

// Undefined when no setting or section has that path.
export const valueAt = (settings: Settings, path: string | null): unknown =>
  path === null
    ? settings
    : path
        .split(".")
        .reduce<unknown>(
          (value, key) =>
            typeof value === "object" && value !== null && Object.hasOwn(value, key)
              ? (value as Record<string, unknown>)[key]
              : undefined,
          settings,
        )
