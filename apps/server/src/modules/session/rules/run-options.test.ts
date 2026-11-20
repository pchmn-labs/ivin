import { expect, test } from "vitest"
import { newSessionRunOptions, runOptionChanges, sameRunOptions } from "./run-options.ts"

const offer = (value: string) => ({ value, name: value.toUpperCase(), description: null })

const offered = {
  model: {
    values: ["a", "b"].map((value) => ({ ...offer(value), efforts: [], older: false })),
    default: "a",
  },
  effort: { values: [offer("low"), offer("high")], default: "low" },
  permissionMode: { values: [offer("ask"), offer("auto")], default: "ask" },
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

test("a change lists only the options whose value differs, in a fixed order, with their names", () => {
  expect(
    runOptionChanges(
      { model: "a", effort: "low", permissionMode: "ask" },
      { permissionMode: "auto", model: "a", effort: "high" },
      offered,
    ),
  ).toEqual([
    { option: "effort", from: "low", to: "high", fromName: "LOW", toName: "HIGH" },
    { option: "permissionMode", from: "ask", to: "auto", fromName: "ASK", toName: "AUTO" },
  ])
})

test("a value the harness no longer offers is named by its value", () => {
  expect(
    runOptionChanges(
      { model: "gone", effort: "low", permissionMode: "ask" },
      { model: "b" },
      offered,
    ),
  ).toEqual([{ option: "model", from: "gone", to: "b", fromName: "gone", toName: "B" }])
})

test("two sets of options are the same when every value matches", () => {
  const options = { model: "a", effort: "low", permissionMode: "ask" }
  expect(sameRunOptions(options, { ...options })).toBe(true)
  expect(sameRunOptions(options, { ...options, effort: "high" })).toBe(false)
})
