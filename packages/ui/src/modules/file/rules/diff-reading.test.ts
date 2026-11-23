import { GitFailed } from "@ivin/contracts/file"
import { expect, test } from "vitest"
import { diffReading, diffReadingFailure } from "./diff-reading.ts"

test("a git failure keeps git's message beside the UI's own, with Retry", () => {
  const error = new GitFailed({ sessionId: "s", gitMessage: "fatal: index file corrupt" })
  expect(diffReadingFailure(error, "src/a.ts")).toEqual({
    kind: "message",
    text: "Git could not show the diff of a.ts. Fix what it reports, then retry.",
    retryable: true,
    gitMessage: "fatal: index file corrupt",
  })
})

test("a diff that cannot be shown says why, naming the file", () => {
  expect(diffReading({ kind: "too_large" }, "src/big.ts", "diff")).toMatchObject({
    text: "The diff of big.ts is over the 4 MB ivin shows, so it is not shown.",
  })
  expect(diffReading({ kind: "unchanged" }, "src/a.ts", "diff")).toMatchObject({
    text: "a.ts has no uncommitted changes.",
    retryable: false,
  })
})

test("a committed diff says the branch's commits did not change the file, or why it has no base", () => {
  expect(diffReading({ kind: "unchanged" }, "src/a.ts", "committed_diff")).toMatchObject({
    text: "The branch's commits did not change a.ts.",
  })
  expect(diffReading({ kind: "no_default_branch" }, "src/a.ts", "committed_diff")).toMatchObject({
    text: "Git does not know origin's default branch, so the branch's commits cannot be shown. Run git remote set-head origin --auto.",
  })
})
