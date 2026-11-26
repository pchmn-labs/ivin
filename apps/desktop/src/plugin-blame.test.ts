import { expect, test } from "vitest"
import { mergeDisabledPlugins, pluginsToBlame } from "./plugin-blame.ts"

const at = (time: number, id: string, phase: "activating" | "activated") => ({
  at: time,
  id,
  phase,
})

test("a plugin still activating when the window froze is blamed alone", () => {
  expect(
    pluginsToBlame(
      [at(1, "a", "activating"), at(2, "a", "activated"), at(3, "b", "activating")],
      5,
    ),
  ).toEqual(["b"])
})

test("a plugin whose activation finished is not stuck, and is blamed as recent", () => {
  expect(pluginsToBlame([at(1, "a", "activating"), at(2, "a", "activated")], 3)).toEqual(["a"])
})

test("with nobody stuck, the plugins activated in the 10 seconds before the freeze are blamed", () => {
  const events = [
    at(1_000, "old", "activating"),
    at(1_001, "old", "activated"),
    at(50_000, "new", "activating"),
    at(50_001, "new", "activated"),
    at(52_000, "new", "activating"),
    at(52_001, "new", "activated"),
  ]
  expect(pluginsToBlame(events, 55_000)).toEqual(["new"])
})

test("with nothing stuck and nothing recent, nobody is blamed", () => {
  expect(pluginsToBlame([at(0, "a", "activated")], 60_000)).toEqual([])
  expect(pluginsToBlame([], 60_000)).toEqual([])
})

test("blamed ids join the disabled plugins without duplicates", () => {
  expect(mergeDisabledPlugins('["a","b"]', ["b", "c", "c"])).toEqual(["a", "b", "c"])
})

test("a missing or malformed disabled-plugins file counts as empty", () => {
  expect(mergeDisabledPlugins(null, ["a"])).toEqual(["a"])
  expect(mergeDisabledPlugins("{oops", ["a"])).toEqual(["a"])
  expect(mergeDisabledPlugins('{"a":1}', ["a"])).toEqual(["a"])
  expect(mergeDisabledPlugins('["a",3]', ["b"])).toEqual(["a", "b"])
})
