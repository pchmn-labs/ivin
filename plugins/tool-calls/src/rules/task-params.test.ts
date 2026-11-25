import { expect, test } from "vitest"
import { taskIcon, taskTitle } from "./task-params.ts"

test("the task view's tab shows the task's name, or Task without one", () => {
  expect(taskTitle({ taskId: "k1", description: "Review the diff" })).toBe("Review the diff")
  expect(taskTitle({ taskId: "k1" })).toBe("Task")
})

test("a command's tab shows a terminal, a subagent's a robot", () => {
  expect(taskIcon({ taskId: "k1", kind: "command" })).toBe("terminal")
  expect(taskIcon({ taskId: "k1", kind: "agent" })).toBe("robot")
})
