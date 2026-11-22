import { expect, test } from "vitest"
import { skillInstallAction } from "./skill-install-action.ts"

test.each([
  ["absent", { exists: false, marker: null }, "install"],
  ["ours and outdated", { exists: true, marker: "old" }, "update"],
  ["ours and current", { exists: true, marker: "v1" }, "keep"],
  ["someone else's", { exists: true, marker: null }, "leave"],
] as const)("a skill folder %s is given action %s", (_, installed, action) => {
  expect(skillInstallAction(installed, "v1")).toBe(action)
})
