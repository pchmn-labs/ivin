import { FileNotRead, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import { fileReading, fileReadingFailure } from "./file-reading.ts"

test("a text file shows its text; a large or binary file shows why it is not shown", () => {
  expect(fileReading({ kind: "text", text: "a", version: "1" }, "src/a.ts")).toEqual({
    kind: "text",
    text: "a",
    version: "1",
  })
  expect(fileReading({ kind: "too_large", size: 5.5 * 1024 * 1024 }, "dist/big.js")).toEqual({
    kind: "message",
    text: "big.js is 5.5 MB, over the 2 MB ivin shows, so it is not shown.",
    retryable: false,
  })
  expect(fileReading({ kind: "binary" }, "logo.png")).toEqual({
    kind: "message",
    text: "logo.png is a binary file, so it is not shown.",
    retryable: false,
  })
})

test("each failure names the file, and offers a retry only when one can work", () => {
  const failure = (error: unknown) => fileReadingFailure(error, "src/a.ts")
  const ids = { sessionId: "s", path: "src/a.ts" }
  expect(failure(new FileNotRead({ ...ids, reason: "missing" }))).toEqual({
    kind: "message",
    text: "a.ts no longer exists. Retry once it is back.",
    retryable: true,
  })
  expect(failure(new FileNotRead({ ...ids, reason: "unreadable" }))).toMatchObject({
    text: "a.ts could not be read. Check its permissions, then retry.",
    retryable: true,
  })
  expect(failure(new PathOutsideWorkingFolder(ids))).toMatchObject({ retryable: false })
  expect(failure(new WorkingFolderDeleted({ sessionId: "s" }))).toMatchObject({ retryable: false })
  expect(failure(new SessionNotFound({ sessionId: "s" }))).toMatchObject({ retryable: false })
  expect(failure(new Error("socket closed"))).toEqual({
    kind: "message",
    text: "a.ts could not be opened. Retry.",
    retryable: true,
  })
})
