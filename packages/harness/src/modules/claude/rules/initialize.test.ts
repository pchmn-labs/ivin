import { expect, test } from "vitest"
import initialize from "./fixtures/initialize.jsonl?raw"
import { initializeRequestLine, modelsFromInitialize } from "./initialize.ts"

const response = JSON.parse(initialize.trim()) as unknown

test("the initialize request is one control request line with its id", () => {
  expect(JSON.parse(initializeRequestLine("init"))).toEqual({
    type: "control_request",
    request_id: "init",
    request: { subtype: "initialize" },
  })
})

test("the latest models come first, by alias, with Claude Code's names", () => {
  const models = modelsFromInitialize(response, "init")!
  expect(models.filter((model) => !model.older).map(({ value, name }) => [value, name])).toEqual([
    ["opus", "Opus 5.5"],
    ["fable", "Fable 5.2"],
    ["sonnet", "Sonnet 5.5"],
    ["haiku", "Haiku 5.5"],
  ])
  expect(models[0]).toEqual({
    value: "opus",
    name: "Opus 5.5",
    description: "For complex work and everyday tasks",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    older: false,
  })
})

test("pinned versions are older models, and default is left out", () => {
  const models = modelsFromInitialize(response, "init")!
  expect(models.map((model) => model.value)).not.toContain("default")
  expect(models.filter((model) => model.older).map((model) => model.name)).toEqual([
    "Fable 5.1",
    "Haiku 4.5",
    "Sonnet 5",
    "Opus 5",
    "Fable 5",
    "Opus 4.8",
    "Opus 4.7",
    "Opus 4.6",
    "Sonnet 4.6",
  ])
})

test("each model keeps the efforts it accepts, none when it takes no effort", () => {
  const models = modelsFromInitialize(response, "init")!
  const effortsOf = (name: string) => models.find((model) => model.name === name)?.efforts
  expect(effortsOf("Opus 4.6")).toEqual(["low", "medium", "high", "max"])
  expect(effortsOf("Haiku 4.5")).toEqual([])
})

test("a line that is not the response to the request is skipped", () => {
  expect(modelsFromInitialize(response, "other")).toBeUndefined()
  expect(modelsFromInitialize({ type: "system", subtype: "init" }, "init")).toBeUndefined()
})

test("a response with no readable models gives an empty list", () => {
  const failed = {
    type: "control_response",
    response: { subtype: "error", request_id: "init", error: "nope" },
  }
  const odd = {
    type: "control_response",
    response: { subtype: "success", request_id: "init", response: { models: "none" } },
  }
  expect(modelsFromInitialize(failed, "init")).toEqual([])
  expect(modelsFromInitialize(odd, "init")).toEqual([])
})
