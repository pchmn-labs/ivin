import { expect, test } from "vitest"
import { claudeArgs } from "./claude-args.ts"
import { claudeRunOptions } from "./run-options.ts"

const options = { model: "haiku", effort: "high", permissionMode: "manual" }

const valueAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

test("a stored session id is passed to claude with --resume", () => {
  expect(claudeArgs(options, "abc").slice(-2)).toEqual(["--resume", "abc"])
  expect(claudeArgs(options, null)).not.toContain("--resume")
})

test.each(claudeRunOptions.effort.values)("effort %s is passed with --effort", (effort) => {
  expect(valueAfter(claudeArgs({ ...options, effort }, null), "--effort")).toBe(effort)
})

test.each(claudeRunOptions.permissionMode.values)(
  "permission mode %s is passed with --permission-mode",
  (permissionMode) => {
    expect(valueAfter(claudeArgs({ ...options, permissionMode }, null), "--permission-mode")).toBe(
      permissionMode,
    )
  },
)

test("claude offers its five efforts and six permission modes", () => {
  expect(claudeRunOptions.effort.values).toEqual(["low", "medium", "high", "xhigh", "max"])
  expect(claudeRunOptions.permissionMode.values).toEqual([
    "manual",
    "acceptEdits",
    "auto",
    "dontAsk",
    "plan",
    "bypassPermissions",
  ])
})
