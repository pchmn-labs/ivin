import { expect, test } from "vitest"
import {
  checkoutStart,
  freeWorkspaceBranch,
  subfolderNames,
  workingFolderPath,
} from "./workspace-folder.ts"

test("folders sharing a parent start in it; others in the first, with the rest as extra directories", () => {
  expect(checkoutStart(["/w/api", "/w/web"])).toEqual({ cwd: "/w", extraDirectories: [] })
  expect(checkoutStart(["/a/api", "/b/web", "/c/db"])).toEqual({
    cwd: "/a/api",
    extraDirectories: ["/b/web", "/c/db"],
  })
  expect(checkoutStart(["/w/api"])).toEqual({ cwd: "/w/api", extraDirectories: [] })
  expect(checkoutStart([])).toBeNull()
})

test("folders with the same name get -2, -3", () => {
  expect(subfolderNames(["/a/app", "/b/app", "/c/app", "/d/lib"])).toEqual([
    "app",
    "app-2",
    "app-3",
    "lib",
  ])
})

test("the branch is the first free one", () => {
  expect(freeWorkspaceBranch("12345678-aaaa", () => false)).toBe("ivin/12345678")
  expect(freeWorkspaceBranch("12345678-aaaa", (b) => b === "ivin/12345678")).toBe("ivin/12345678-2")
})

test("the working folder is named after the workspace and the branch", () => {
  expect(workingFolderPath("/h/.ivin/worktrees/", "ws", "ivin/12345678")).toBe(
    "/h/.ivin/worktrees/ws/ivin-12345678",
  )
})
