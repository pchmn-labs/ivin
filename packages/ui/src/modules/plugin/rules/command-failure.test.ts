import { expect, test } from "vitest"
import { commandFailureMessage } from "./command-failure.ts"

test("a command that failed shows the reason its plugin gave", () => {
  expect(
    commandFailureMessage({ _tag: "CommandFailed", command: "x", reason: "no token" }, "x"),
  ).toBe("no token")
})

test("a command no plugin registers is named", () => {
  expect(commandFailureMessage({ _tag: "CommandNotFound", command: "x" }, "x")).toContain("x")
})
