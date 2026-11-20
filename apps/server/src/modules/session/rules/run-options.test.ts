import { expect, test } from "vitest"
import { newSessionRunOptions, runOptionChanges, sameRunOptions } from "./run-options.ts"

const offered = {
  model: { values: ["a", "b"], default: "a" },
  effort: { values: ["low", "high"], default: "low" },
  permissionMode: { values: ["ask", "auto"], default: "ask" },
}

test("a new session takes the harness's defaults when its project has no last options", () => {
  expect(newSessionRunOptions(offered, null)).toEqual({
    model: "a",
    effort: "low",
    permissionMode: "ask",
  })
})

test("a new session takes each last value the harness still offers", () => {
  expect(
    newSessionRunOptions(offered, { model: "gone", effort: "high", permissionMode: "auto" }),
  ).toEqual({ model: "a", effort: "high", permissionMode: "auto" })
})

test("a change lists only the options whose value differs, in a fixed order", () => {
  expect(
    runOptionChanges(
      { model: "a", effort: "low", permissionMode: "ask" },
      { permissionMode: "auto", model: "a", effort: "high" },
    ),
  ).toEqual([
    { option: "effort", from: "low", to: "high" },
    { option: "permissionMode", from: "ask", to: "auto" },
  ])
})

test("two sets of options are the same when every value matches", () => {
  const options = { model: "a", effort: "low", permissionMode: "ask" }
  expect(sameRunOptions(options, { ...options })).toBe(true)
  expect(sameRunOptions(options, { ...options, effort: "high" })).toBe(false)
})
