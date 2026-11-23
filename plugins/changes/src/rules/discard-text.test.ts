import { expect, test } from "vitest"
import { discardAllText, discardText } from "./discard-text.ts"

const change = (status: "modified" | "added" | "untracked") => ({
  path: "src/cart.ts",
  previousPath: null,
  status,
  added: null,
  deleted: null,
})

test("discarding a tracked file restores it, and an untracked or a new one deletes it", () => {
  expect(discardText(change("modified"))).toEqual({
    title: "Discard the changes to “cart.ts”?",
    description: "The file goes back to its last commit. This cannot be undone.",
    action: "Discard changes",
  })
  expect(discardText(change("untracked"))).toEqual({
    title: "Delete “cart.ts”?",
    description:
      "Git does not track this file, so discarding its changes deletes it. This cannot be undone.",
    action: "Delete file",
  })
  expect(discardText(change("added"))).toEqual({
    title: "Delete “cart.ts”?",
    description:
      "The file is new since the last commit, so discarding its changes deletes it. This cannot be undone.",
    action: "Delete file",
  })
})

test("discarding them all says how many files go back and how many are deleted", () => {
  expect(
    discardAllText([change("modified"), change("modified"), change("untracked")]).description,
  ).toBe("2 files go back to their last commit, and 1 new file is deleted. This cannot be undone.")
  expect(discardAllText([change("added")]).description).toBe(
    "1 new file is deleted. This cannot be undone.",
  )
})
