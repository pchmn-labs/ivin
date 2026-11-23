import { Settings, type SettingValueInvalid } from "@ivin/contracts/setting"
import * as Schema from "effect/Schema"

interface Expected {
  readonly expected: SettingValueInvalid["expected"]
  readonly allowed?: ReadonlyArray<string>
}

interface Leaf extends Expected {
  readonly path: string
  readonly is: (value: unknown) => boolean
}

const expectedOf = (schema: Schema.Struct.Fields[string], path: string): Expected => {
  const { ast } = schema
  switch (ast._tag) {
    case "Boolean":
      return { expected: "boolean" }
    case "Number":
      return { expected: ast.checks === undefined ? "number" : "wholeNumber" }
    case "String":
      return { expected: "string" }
    case "Union":
      if (ast.types.every((type) => type._tag === "Literal" && typeof type.literal === "string")) {
        return {
          expected: "oneOf",
          allowed: ast.types.map((type) => (type as typeof type & { literal: string }).literal),
        }
      }
  }
  throw new Error(`The setting ${path} has a type settings set cannot check.`)
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
            ...expectedOf(schema, path),
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
  | ({ readonly ok: false; readonly reason: "invalidValue" } & Expected) => {
  const leaf = leaves.get(path)
  if (leaf === undefined) return { ok: false, reason: "unknownPath" }
  if (leaf.is(value)) return { ok: true }
  return {
    ok: false,
    reason: "invalidValue",
    expected: leaf.expected,
    ...(leaf.allowed !== undefined && { allowed: leaf.allowed }),
  }
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
