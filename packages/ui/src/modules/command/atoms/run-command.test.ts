import { AtomRegistry } from "effect/reactivity"
import { expect, test } from "vitest"
import { addCommandHandler, runCommand } from "./run-command.ts"

test("a command runs through its last handler, and does nothing once none is left", () => {
  const registry = AtomRegistry.make()
  const ran: Array<string> = []
  const removeFirst = addCommandHandler(registry, "a.b", () => ran.push("first"), null)
  const removeSecond = addCommandHandler(registry, "a.b", () => ran.push("second"), "p")

  expect(runCommand(registry, "a.b")).toBe(true)
  removeSecond()
  expect(runCommand(registry, "a.b")).toBe(true)
  removeFirst()
  expect(runCommand(registry, "a.b")).toBe(false)
  expect(runCommand(registry, "unknown")).toBe(false)
  expect(ran).toEqual(["second", "first"])
})
