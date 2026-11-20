import { expect, test } from "vitest"
import { goBackLabel, offeredValues, relaunchFailureText } from "./run-options.ts"

const offered = {
  model: { values: ["a", "b"], default: "a" },
  effort: { values: ["low"], default: "low" },
  permissionMode: { values: ["ask"], default: "ask" },
}

test("a menu lists the harness's values, and keeps the current one first when it is not offered", () => {
  expect(offeredValues(offered, "model", "b")).toEqual(["a", "b"])
  expect(offeredValues(offered, "model", "retired")).toEqual(["retired", "a", "b"])
  expect(offeredValues(null, "effort", "high")).toEqual(["high"])
})

test("a failed relaunch names the changed values and offers the previous one back", () => {
  const previous = { model: "a", effort: "low", permissionMode: "ask" }
  const current = { ...previous, model: "not-a-model" }

  expect(relaunchFailureText(current, previous)).toBe(
    "The agent failed on the first message with model not-a-model. Go back to what worked, or pick another value.",
  )
  expect(goBackLabel(current, previous)).toBe("Back to a")
  expect(goBackLabel({ ...current, effort: "max" }, previous)).toBe("Go back")
})
