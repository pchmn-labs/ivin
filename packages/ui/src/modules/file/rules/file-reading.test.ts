import { FileNotRead, PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { SessionNotFound, WorkingFolderDeleted } from "@ivin/contracts/session"
import { expect, test } from "vitest"
import {
  byteSize,
  fileReading,
  fileReadingFailure,
  imageNotShown,
  isSvgPath,
  svgSource,
} from "./file-reading.ts"

test("a text file shows its text; a large or binary file shows why it is not shown", () => {
  expect(fileReading({ kind: "text", text: "a", version: "1" }, "src/a.ts")).toEqual({
    kind: "text",
    text: "a",
    version: "1",
  })
  expect(
    fileReading(
      { kind: "too_large", size: 5.5 * 1024 * 1024, limit: 2 * 1024 * 1024 },
      "dist/big.js",
    ),
  ).toEqual({
    kind: "message",
    text: "big.js is 5.5 MB, over the 2 MB ivin shows, so it is not shown.",
    retryable: false,
  })
  expect(
    fileReading({ kind: "too_large", size: 48.2 * 1024 * 1024, limit: 10 * 1024 * 1024 }, "a.gif"),
  ).toMatchObject({ text: "a.gif is 48.2 MB, over the 10 MB ivin shows, so it is not shown." })
  expect(fileReading({ kind: "binary" }, "logo.png")).toEqual({
    kind: "message",
    text: "logo.png is a binary file, so it is not shown.",
    retryable: false,
  })
})

test("an image shows from its bytes, with their size", () => {
  expect(
    fileReading({ kind: "image", mimeType: "image/png", data: "iVBORw0K", version: "1" }, "a.png"),
  ).toEqual({ kind: "image", src: "data:image/png;base64,iVBORw0K", bytes: 6 })
  expect(
    fileReading({ kind: "image", mimeType: "image/gif", data: "R0lGOA==", version: "1" }, "a.gif"),
  ).toMatchObject({ bytes: 4 })
})

test("an SVG's text shows as an image, never as markup in the page", () => {
  expect(isSvgPath("assets/Mark.SVG")).toBe(true)
  expect(isSvgPath("assets/mark.svg.ts")).toBe(false)
  expect(svgSource("<svg><text>a & b</text></svg>")).toBe(
    "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Ctext%3Ea%20%26%20b%3C%2Ftext%3E%3C%2Fsvg%3E",
  )
})

test("an image that does not decode, and the size of an image, read in plain words", () => {
  expect(imageNotShown("assets/broken.png")).toBe(
    "broken.png cannot be shown: its data is damaged or in a format ivin cannot read.",
  )
  expect(byteSize(612)).toBe("612 B")
  expect(byteSize(319_488)).toBe("312 KB")
  expect(byteSize(1.4 * 1024 * 1024)).toBe("1.4 MB")
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
