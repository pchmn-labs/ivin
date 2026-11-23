import { FolderNotListed, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { GitFailed } from "@ivin/contracts/file"
import { fileListingFailure, folderListingFailure, gitStatusFailure } from "./folder-listing.ts"

test("a deleted working folder is its own state, not a failure", () => {
  expect(folderListingFailure(new WorkingFolderDeleted({ sessionId: "s" }), "")).toEqual({
    kind: "deleted",
  })
})

test("each failure names the folder, and offers a retry only when one can work", () => {
  const failure = (error: unknown, path: string) => {
    const listing = folderListingFailure(error, path)
    return listing.kind === "failed" ? listing.failure : null
  }
  expect(
    failure(new FolderNotListed({ sessionId: "s", path: "src", reason: "missing" }), "src"),
  ).toEqual({ text: "The folder src no longer exists. Retry once it is back.", retryable: true })
  expect(
    failure(new FolderNotListed({ sessionId: "s", path: "", reason: "unreadable" }), ""),
  ).toEqual({
    text: "The working folder could not be read. Check its permissions, then retry.",
    retryable: true,
  })
  expect(failure(new PathOutsideWorkingFolder({ sessionId: "s", path: ".." }), "..")).toMatchObject(
    { retryable: false },
  )
  expect(failure(new SessionNotFound({ sessionId: "s" }), "")).toMatchObject({ retryable: false })
  expect(failure(new Error("connection lost"), "src")).toEqual({
    text: "The folder src could not be listed. Retry.",
    retryable: true,
  })
})

test("a file listing that fails says why, and offers a retry when one can work", () => {
  expect(fileListingFailure({ _tag: "WorkingFolderDeleted" })).toEqual({ kind: "deleted" })
  expect(fileListingFailure({ _tag: "SessionNotFound" })).toEqual({
    kind: "failed",
    failure: {
      text: "This session no longer exists, so its files cannot be listed.",
      retryable: false,
    },
  })
  expect(fileListingFailure(new Error("lost"))).toEqual({
    kind: "failed",
    failure: { text: "The working folder's files could not be listed. Retry.", retryable: true },
  })
})

test("a git failure says git could not list the files, or read which changed, and offers a retry", () => {
  const error = new GitFailed({ sessionId: "s", gitMessage: "index file corrupt" })
  expect(fileListingFailure(error)).toEqual({
    kind: "failed",
    failure: { text: "Git could not list the working folder's files. Retry.", retryable: true },
  })
  expect(gitStatusFailure(error)).toEqual({
    text: "Git could not read which files changed, so the files show no status. Retry.",
    retryable: true,
  })
  expect(gitStatusFailure(new WorkingFolderDeleted({ sessionId: "s" }))).toBeNull()
})
