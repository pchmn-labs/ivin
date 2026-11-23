import { expect, test } from "vitest"
import { shownPanel } from "./shown-panel.ts"

const c = (id: string, replaces?: string) => ({ id, replaces })

test("the picked panel shows when it is visible", () => {
  const all = [c("sessions/panel"), c("files/panel")]
  expect(shownPanel(all, all, "files/panel")?.id).toBe("files/panel")
})

test("a picked panel that another replaces shows its replacement, through a chain", () => {
  const all = [c("sessions/panel"), c("a/panel", "sessions/panel"), c("b/panel", "a/panel")]
  const visible = [all[2]!]
  expect(shownPanel(all, visible, "sessions/panel")?.id).toBe("b/panel")
})

test("a picked panel that no longer exists falls back to the first visible one", () => {
  const all = [c("sessions/panel"), c("files/panel")]
  expect(shownPanel(all, all, "sessions")?.id).toBe("sessions/panel")
  expect(shownPanel([], [], "sessions")).toBeUndefined()
})

test("a replace cycle ends on the first visible panel", () => {
  const all = [c("a", "b"), c("b", "a"), c("files/panel")]
  expect(shownPanel(all, [all[2]!], "a")?.id).toBe("files/panel")
})
