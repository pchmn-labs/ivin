import { GitFailed } from "@ivin/contracts/file"
import { expect, test } from "vitest"
import { changeListingFailure } from "./change-listing.ts"

test("a git failure keeps git's message beside the UI's own, with Retry", () => {
  const error = new GitFailed({ sessionId: "s", gitMessage: "fatal: index file corrupt" })
  expect(changeListingFailure(error)).toEqual({
    kind: "failed",
    failure: {
      text: "Git could not list the changes. Fix what it reports, then retry.",
      retryable: true,
    },
    gitMessage: "fatal: index file corrupt",
  })
})

test("a deleted working folder is a state of the list, not a failure", () => {
  expect(changeListingFailure({ _tag: "WorkingFolderDeleted" })).toEqual({ kind: "deleted" })
})
