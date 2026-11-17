import { expect, test } from "vitest"
import { statusLabel } from "./status-label.ts"

test("each status has a plain label", () => {
  expect(statusLabel("working")).toBe("Working")
  expect(statusLabel("waiting")).toBe("Waiting for you")
  expect(statusLabel("idle")).toBe("Idle")
  expect(statusLabel("failed")).toBe("Failed")
})
