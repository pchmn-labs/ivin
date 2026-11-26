import { expect, test } from "vitest"
import { claudeArgs } from "./claude-args.ts"
import { FALLBACK_MODELS, claudeRunOptions } from "./run-options.ts"

const options = { model: "haiku", effort: "high", permissionMode: "manual" }

const valueAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

test("a stored session id is passed to claude with --resume", () => {
  expect(claudeArgs(options, "abc").slice(-2)).toEqual(["--resume", "abc"])
  expect(claudeArgs(options, null)).not.toContain("--resume")
})

test("each extra directory is passed with its own --add-dir, before --resume", () => {
  const args = claudeArgs(options, "abc", ["/a", "/b"])
  expect(args.join(" ")).toContain("--add-dir /a --add-dir /b --resume abc")
  expect(claudeArgs(options, null)).not.toContain("--add-dir")
})

const offered = claudeRunOptions([])
const efforts = offered.effort.values.map((effort) => effort.value)
const permissionModes = offered.permissionMode.values.map((mode) => mode.value)

test("the effort and the permission mode are passed with --effort and --permission-mode", () => {
  const args = claudeArgs({ ...options, effort: "max", permissionMode: "acceptEdits" }, null)
  expect(valueAfter(args, "--effort")).toBe("max")
  expect(valueAfter(args, "--permission-mode")).toBe("acceptEdits")
})

test("claude offers its five efforts and six permission modes", () => {
  expect(efforts).toEqual(["low", "medium", "high", "xhigh", "max"])
  expect(permissionModes).toEqual([
    "manual",
    "acceptEdits",
    "auto",
    "dontAsk",
    "plan",
    "bypassPermissions",
  ])
})

test("with no listed model, claude offers its four aliases and starts on sonnet", () => {
  expect(offered.model.values).toEqual(FALLBACK_MODELS)
  expect(offered.model.default).toBe("sonnet")
})

test("a listed model set without sonnet starts on its first model", () => {
  const [opus] = FALLBACK_MODELS
  expect(claudeRunOptions([opus!]).model.default).toBe("opus")
})
