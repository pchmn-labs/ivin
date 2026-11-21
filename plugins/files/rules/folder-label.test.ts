import { expect, test } from "vitest"
import { folderLabel } from "./folder-label.ts"

test("the checkout is named by its project, a worktree inside it by its relative path", () => {
  expect(folderLabel("/dev/shop", "/dev/shop", "shop")).toBe("shop")
  expect(folderLabel("/dev/shop/.worktrees/fix", "/dev/shop", "shop")).toBe(".worktrees/fix")
})

test("a folder outside the project keeps its full path", () => {
  expect(folderLabel("/dev/shop-other", "/dev/shop", "shop")).toBe("/dev/shop-other")
})
