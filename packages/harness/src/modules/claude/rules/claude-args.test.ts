import { expect, test } from "vitest"
import { claudeArgs } from "./claude-args.ts"

test("a stored session id is passed to claude with --resume", () => {
  expect(claudeArgs("haiku", "abc").slice(-2)).toEqual(["--resume", "abc"])
  expect(claudeArgs("haiku", null)).not.toContain("--resume")
})
