import { expect, test } from "vitest"
import { effortFor, offeredValues, shownRunOptions, usableEfforts } from "./run-options.ts"

const value = (value: string, name: string) => ({ value, name, description: null })
const model = (id: string, name: string, efforts: string[]) => ({
  ...value(id, name),
  efforts,
  older: false,
})

const offered = {
  model: {
    values: [
      model("big", "Big 2", ["low", "high", "max"]),
      model("tiny", "Tiny 1", []),
      model("mid", "Mid 3", ["low", "medium"]),
    ],
    default: "big",
  },
  effort: {
    values: [
      value("low", "Low"),
      value("medium", "Medium"),
      value("high", "High"),
      value("max", "Max"),
    ],
    default: "high",
  },
  permissionMode: { values: [value("ask", "Ask")], default: "ask" },
}

test("a column lists the harness's values, and keeps the current one first when it is not offered", () => {
  expect(offeredValues(offered, "permissionMode", "ask").map((offer) => offer.value)).toEqual([
    "ask",
  ])
  expect(offeredValues(offered, "permissionMode", "retired")).toEqual([
    { value: "retired", name: "retired", description: null },
    value("ask", "Ask"),
  ])
  expect(offeredValues(null, "effort", "high")).toEqual([value("high", "high")])
})

test("the efforts a model accepts, all of them for a model the harness does not list", () => {
  expect(usableEfforts(offered, "mid")).toEqual(["low", "medium"])
  expect(usableEfforts(offered, "tiny")).toEqual([])
  expect(usableEfforts(offered, "unknown")).toEqual(["low", "medium", "high", "max"])
})

test("switching model keeps an accepted effort and moves another to the closest lower level", () => {
  expect(effortFor(offered, "big", "high")).toBe("high")
  expect(effortFor(offered, "mid", "max")).toBe("medium")
  expect(effortFor(offered, "big", "medium")).toBe("low")
})

test("an effort with no accepted level below it moves to the lowest accepted, or stays for a model with none", () => {
  const onlyHigh = {
    ...offered,
    model: { ...offered.model, values: [model("odd", "Odd", ["high"])] },
  }
  expect(effortFor(onlyHigh, "odd", "low")).toBe("high")
  expect(effortFor(offered, "tiny", "max")).toBe("max")
})

test("the trigger names the values, and leaves out the effort of a model that takes none", () => {
  const names = (offeredOrNull: typeof offered | null, model: string) =>
    shownRunOptions(offeredOrNull, { model, effort: "max", permissionMode: "ask" }).map(
      ({ option, name }) => `${option}=${name}`,
    )
  expect(names(offered, "big")).toEqual(["model=Big 2", "effort=Max", "permissionMode=Ask"])
  expect(names(offered, "tiny")).toEqual(["model=Tiny 1", "permissionMode=Ask"])
  expect(names(null, "big")).toEqual(["model=big", "effort=max", "permissionMode=ask"])
})
