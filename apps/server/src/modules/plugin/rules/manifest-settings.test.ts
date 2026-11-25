import { expect, test } from "vitest"
import { readManifestSettings } from "./manifest-settings.ts"

const base = { title: "Fold after", description: "Rows before a fold." }

test("no settings key declares no setting", () => {
  expect(readManifestSettings("prs", "Session PRs", undefined)).toEqual({
    kind: "valid",
    settings: [],
  })
})

test("each setting carries its plugin, type, default, title and description", () => {
  const reading = readManifestSettings("prs", "Session PRs", {
    foldThreshold: { type: "number", default: 2, ...base },
    compact: { type: "boolean", default: false, ...base },
    name: { type: "string", default: "a", ...base },
    layout: { type: "string", default: "rail", values: ["rail", "strip"], ...base },
  })
  expect(reading).toEqual({
    kind: "valid",
    settings: [
      {
        pluginId: "prs",
        pluginName: "Session PRs",
        key: "foldThreshold",
        type: "number",
        default: 2,
        ...base,
      },
      {
        pluginId: "prs",
        pluginName: "Session PRs",
        key: "compact",
        type: "boolean",
        default: false,
        ...base,
      },
      {
        pluginId: "prs",
        pluginName: "Session PRs",
        key: "name",
        type: "string",
        default: "a",
        ...base,
      },
      {
        pluginId: "prs",
        pluginName: "Session PRs",
        key: "layout",
        type: "string",
        default: "rail",
        values: ["rail", "strip"],
        ...base,
      },
    ],
  })
})

test.each([
  ["not an object", [], "ivin.settings"],
  ["an unknown type", { a: { type: "date", default: 1, ...base } }, "ivin.settings.a.type"],
  [
    "a default of the wrong type",
    { a: { type: "number", default: "2", ...base } },
    "ivin.settings.a.default",
  ],
  [
    "a default outside the values",
    { a: { type: "string", default: "x", values: ["y"], ...base } },
    "ivin.settings.a.default",
  ],
  [
    "values on a number",
    { a: { type: "number", default: 1, values: ["y"], ...base } },
    "ivin.settings.a.values",
  ],
  [
    "empty values",
    { a: { type: "string", default: "x", values: [], ...base } },
    "ivin.settings.a.values",
  ],
  [
    "no title",
    { a: { type: "boolean", default: true, description: "d" } },
    "ivin.settings.a.title",
  ],
  [
    "no description",
    { a: { type: "boolean", default: true, title: "t" } },
    "ivin.settings.a.description",
  ],
  ["a key with a dot", { "a.b": { type: "boolean", default: true, ...base } }, "ivin.settings.a.b"],
  ["a setting that is not an object", { a: 3 }, "ivin.settings.a"],
])("%s is refused, naming the setting", (_name, settings, reason) => {
  const reading = readManifestSettings("prs", "prs", settings)
  expect(reading.kind).toBe("invalid")
  expect(reading.kind === "invalid" && reading.reason).toContain(reason)
})
