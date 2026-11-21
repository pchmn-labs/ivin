import { FolderNotListed, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { folderListingFailure } from "./folder-listing.ts"

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
