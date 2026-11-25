import type { PluginSettingDeclaration } from "@ivin/contracts/setting"
import { expect, test } from "vitest"
import {
  checkPluginSetting,
  fileObjectOf,
  pluginSettingPaths,
  pluginSettingValues,
  resolvePluginSettings,
} from "./plugin-settings.ts"

const declaration = (
  key: string,
  type: PluginSettingDeclaration["type"],
  value: boolean | number | string,
  values?: ReadonlyArray<string>,
): PluginSettingDeclaration => ({
  pluginId: "prs",
  pluginName: "Session PRs",
  key,
  type,
  default: value,
  title: key,
  description: `${key}.`,
  ...(values !== undefined && { values }),
})

const declarations = [
  declaration("fold", "number", 2),
  declaration("compact", "boolean", false),
  declaration("layout", "string", "rail", ["rail", "strip"]),
  declaration("label", "string", "PR"),
]

test("a setting left out of the file has its default", () => {
  const settings = resolvePluginSettings({}, declarations)
  expect(settings.map(({ key, value, ignored }) => [key, value, ignored])).toEqual([
    ["fold", 2, false],
    ["compact", false, false],
    ["layout", "rail", false],
    ["label", "PR", false],
  ])
})

test("a value of the right type in the file wins over the default", () => {
  const settings = resolvePluginSettings(
    { prs: { fold: 5, compact: true, layout: "strip", label: "" } },
    declarations,
  )
  expect(settings.map(({ value, ignored }) => [value, ignored])).toEqual([
    [5, false],
    [true, false],
    ["strip", false],
    ["", false],
  ])
})

test("a value of the wrong type, or outside the allowed values, falls back to the default and is flagged", () => {
  const settings = resolvePluginSettings(
    { prs: { fold: "5", compact: 1, layout: "grid", label: 3 } },
    declarations,
  )
  expect(settings.map(({ value, ignored }) => [value, ignored])).toEqual([
    [2, true],
    [false, true],
    ["rail", true],
    ["PR", true],
  ])
})

test("a plugin's section that is not an object is ignored as a whole", () => {
  const settings = resolvePluginSettings({ prs: 3 }, declarations)
  expect(settings.every(({ ignored }) => !ignored)).toBe(true)
})

test("values read as an object per plugin", () => {
  expect(pluginSettingValues(resolvePluginSettings({ prs: { fold: 4 } }, declarations))).toEqual({
    prs: { fold: 4, compact: false, layout: "rail", label: "PR" },
  })
})

test("a path is checked against the declaration", () => {
  expect(checkPluginSetting(declarations, "prs.fold", 3)).toEqual({ ok: true })
  expect(checkPluginSetting(declarations, "prs.fold", "3")).toEqual({
    ok: false,
    reason: "invalidValue",
    expected: "number",
  })
  expect(checkPluginSetting(declarations, "prs.compact", 1)).toMatchObject({ expected: "boolean" })
  expect(checkPluginSetting(declarations, "prs.layout", "grid")).toEqual({
    ok: false,
    reason: "invalidValue",
    expected: "oneOf",
    allowed: ["rail", "strip"],
  })
  expect(checkPluginSetting(declarations, "prs.label", "x")).toEqual({ ok: true })
  expect(checkPluginSetting(declarations, "prs.nope", 1)).toBeNull()
  expect(pluginSettingPaths(declarations)).toEqual([
    "prs.fold",
    "prs.compact",
    "prs.layout",
    "prs.label",
  ])
})

test("the file's object is kept from the last valid text", () => {
  const previous = { prs: { fold: 1 } }
  expect(fileObjectOf('{ "prs": { "fold": 3 } }', previous)).toEqual({ prs: { fold: 3 } })
  expect(fileObjectOf(null, previous)).toEqual({})
  expect(fileObjectOf("  ", previous)).toEqual({})
  expect(fileObjectOf("{", previous)).toBe(previous)
  expect(fileObjectOf("[]", previous)).toBe(previous)
})
