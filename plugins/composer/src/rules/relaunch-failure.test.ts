import { expect, test } from "vitest"
import { changedRunOption, goBackLabel, relaunchFailureText } from "./relaunch-failure.ts"

const value = (value: string, name: string) => ({ value, name, description: null })
const offered = {
  model: {
    values: [
      { ...value("big", "Big 2"), efforts: ["low", "max"], older: false },
      { ...value("mid", "Mid 3"), efforts: ["low"], older: false },
    ],
    default: "big",
  },
  effort: { values: [value("low", "Low"), value("max", "Max")], default: "low" },
  permissionMode: { values: [value("ask", "Ask")], default: "ask" },
}

test("a failed relaunch names the changed values and offers the previous one back", () => {
  const previous = { model: "big", effort: "low", permissionMode: "ask" }
  const current = { ...previous, model: "mid" }

  expect(relaunchFailureText(offered, current, previous)).toBe(
    "The agent did not start with Mid 3.",
  )
  expect(goBackLabel(offered, current, previous)).toBe("Back to Big 2")
  expect(goBackLabel(offered, { ...current, effort: "max" }, previous)).toBe("Go back")
})

test("a value the harness does not name is written as is, and no change says so", () => {
  const previous = { model: "big", effort: "low", permissionMode: "ask" }

  expect(relaunchFailureText(null, { ...previous, model: "x" }, previous)).toBe(
    "The agent did not start with x.",
  )
  expect(relaunchFailureText(offered, previous, previous)).toBe(
    "The agent did not start after the change.",
  )
})

test("the menu opens on the first changed option, or the model when none changed", () => {
  const previous = { model: "big", effort: "low", permissionMode: "ask" }

  expect(changedRunOption({ ...previous, effort: "max" }, previous)).toBe("effort")
  expect(changedRunOption(previous, previous)).toBe("model")
})
