import { expect, test } from "vitest"
import { neighbourProject } from "./neighbour-project.ts"

const projects = [{ path: "/a" }, { path: "/b" }, { path: "/c" }]

test("the next and previous projects follow the open projects' order", () => {
  expect(neighbourProject(projects, "/b", 1)).toBe("/c")
  expect(neighbourProject(projects, "/b", -1)).toBe("/a")
})

test("there is no project past the first and the last, nor around an unknown selection", () => {
  expect(neighbourProject(projects, "/a", -1)).toBeNull()
  expect(neighbourProject(projects, "/c", 1)).toBeNull()
  expect(neighbourProject(projects, null, 1)).toBeNull()
  expect(neighbourProject(projects, "/z", 1)).toBeNull()
})
