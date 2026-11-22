import { expect, test } from "vitest"
import { saveFailure } from "./file-writing.ts"

test("each way a save fails names the file and what to do next", () => {
  const path = "src/main.ts"
  expect(saveFailure({ _tag: "FileNotWritten", reason: "unwritable" }, path)).toEqual({
    text: "main.ts was not saved. Check its permissions, then retry. Your edits are kept.",
    retryable: true,
  })
  expect(saveFailure({ _tag: "FileNotWritten", reason: "missing" }, path)).toEqual({
    text: "main.ts was not saved: its folder no longer exists. Your edits are kept.",
    retryable: true,
  })
  expect(saveFailure({ _tag: "WorkingFolderDeleted" }, path).retryable).toBe(false)
  expect(saveFailure({ _tag: "SessionNotFound" }, path).retryable).toBe(false)
  expect(saveFailure(new Error("lost"), path)).toEqual({
    text: "main.ts was not saved. Retry. Your edits are kept.",
    retryable: true,
  })
})
