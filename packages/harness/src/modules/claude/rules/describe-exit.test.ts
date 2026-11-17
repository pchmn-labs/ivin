import { expect, test } from "vitest"
import { describeExit, type ProcessExit } from "./describe-exit.ts"
import exitsJsonl from "./fixtures/exits.jsonl?raw"

const exits = Object.fromEntries(
  exitsJsonl
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const { name, exit, stderr } = JSON.parse(line) as {
        name: string
        exit: ProcessExit
        stderr: string
      }
      return [name, { exit, stderr }]
    }),
)

test("a claude that is not installed says so in plain words", () => {
  const { exit, stderr } = exits["not-installed"]!

  expect(describeExit(exit, stderr)).toBe("Claude Code is not installed, or it is not on the PATH.")
})

test("a claude that exits with an error says it stopped and keeps the detail", () => {
  const { exit, stderr } = exits["unrecognized-model"]!

  const message = describeExit(exit, stderr)

  expect(message).toMatch(/^Claude Code stopped unexpectedly/)
  expect(message).toContain("unrecognized_model")
  expect(message).toContain("not-a-model")
})

test("a process killed by a signal names the signal", () => {
  const { exit, stderr } = exits["killed-by-signal"]!

  expect(describeExit(exit, stderr)).toBe("Claude Code stopped unexpectedly (SIGTERM).")
})

test("a process we stopped ourselves does not read as a crash", () => {
  const { exit, stderr } = exits["killed-by-signal"]!

  expect(describeExit(exit, stderr, { stoppedByIvin: true })).toBe("Claude Code was stopped.")
})
