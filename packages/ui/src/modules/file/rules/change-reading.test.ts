import { GitFailed } from "@ivin/contracts/file"
import { expect, test } from "vitest"
import { changeListingFailure, diffReading, diffReadingFailure } from "./change-reading.ts"

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
  expect(diffReadingFailure(error, "src/a.ts")).toEqual({
    kind: "message",
    text: "Git could not show the diff of a.ts. Fix what it reports, then retry.",
    retryable: true,
    gitMessage: "fatal: index file corrupt",
  })
})

test("a deleted working folder is a state of the list, not a failure", () => {
  expect(changeListingFailure({ _tag: "WorkingFolderDeleted" })).toEqual({ kind: "deleted" })
})

test("a diff that cannot be shown says why, naming the file", () => {
  expect(diffReading({ kind: "too_large" }, "src/big.ts")).toMatchObject({
    text: "The diff of big.ts is over the 4 MB ivin shows, so it is not shown.",
  })
  expect(diffReading({ kind: "unchanged" }, "src/a.ts")).toMatchObject({
    text: "a.ts has no uncommitted changes.",
    retryable: false,
  })
})
