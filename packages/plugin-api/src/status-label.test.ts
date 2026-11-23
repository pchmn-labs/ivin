import { expect, test } from "vitest"
import { statusLabel } from "./status-label.ts"

test("each status has a plain label", () => {
  expect(statusLabel("preparing_worktree")).toBe("Preparing worktree…")
  expect(statusLabel("working")).toBe("Working")
  expect(statusLabel("waiting")).toBe("Waiting for you")
  expect(statusLabel("in_background")).toBe("In background")
  expect(statusLabel("idle")).toBe("Idle")
  expect(statusLabel("failed")).toBe("Failed")
})
