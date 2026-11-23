import { expect, test } from "vitest"
import { projectLabel } from "./project-label.ts"

test("a project's label adds how many of its sessions wait on the user, when any do", () => {
  expect(projectLabel("ivin", 0)).toBe("ivin")
  expect(projectLabel("ivin", 2)).toBe("ivin · 2 waiting for you")
})
