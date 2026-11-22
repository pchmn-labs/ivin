import { expect, test } from "vitest"
import { skillInstallStatus } from "./skill-install-status.ts"

test.each([
  ["absent", { exists: false, markerVersion: null }, "installed"],
  ["ours and outdated", { exists: true, markerVersion: "old" }, "updated"],
  ["ours and current", { exists: true, markerVersion: "v1" }, "upToDate"],
  ["someone else's", { exists: true, markerVersion: null }, "notOurs"],
] as const)("a skill folder %s ends %s", (_, installed, status) => {
  expect(skillInstallStatus(installed, "v1")).toBe(status)
})
