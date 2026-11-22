import { expect, test } from "vitest"
import { fileLink, hasFileScheme } from "./file-link.ts"

const folder = "/Users/me/repo"

test("a relative path names a file of the working folder", () => {
  expect(fileLink("src/main.ts", folder)).toEqual({ kind: "file", path: "src/main.ts" })
  expect(fileLink("./src/../README.md", folder)).toEqual({ kind: "file", path: "README.md" })
  expect(fileLink("docs/My%20Notes.md", folder)).toEqual({ kind: "file", path: "docs/My Notes.md" })
})

test("an absolute path or a file URL inside the working folder names the same file", () => {
  expect(fileLink("/Users/me/repo/src/main.ts", folder)).toEqual({
    kind: "file",
    path: "src/main.ts",
  })
  expect(fileLink("file:///Users/me/repo/src/main.ts", folder)).toEqual({
    kind: "file",
    path: "src/main.ts",
  })
  expect(fileLink("/Users/me/repo/src/main.ts", `${folder}/`)).toEqual({
    kind: "file",
    path: "src/main.ts",
  })
})

test("a file URL on localhost, or a query after the path, names the same file", () => {
  expect(fileLink("file://localhost/Users/me/repo/src/main.ts", folder)).toEqual({
    kind: "file",
    path: "src/main.ts",
  })
  expect(fileLink("src/main.ts?plain=1#L3", folder)).toEqual({
    kind: "file",
    path: "src/main.ts",
    lines: { start: 3, end: 3 },
  })
})

test("a line or a range after the path is the lines to show", () => {
  const lines = (start: number, end = start) => ({
    kind: "file",
    path: "src/main.ts",
    lines: { start, end },
  })
  expect(fileLink("src/main.ts:42", folder)).toEqual(lines(42))
  expect(fileLink("src/main.ts:42:7", folder)).toEqual(lines(42))
  expect(fileLink("src/main.ts:42-50", folder)).toEqual(lines(42, 50))
  expect(fileLink("src/main.ts#L42", folder)).toEqual(lines(42))
  expect(fileLink("src/main.ts#L42-L50", folder)).toEqual(lines(42, 50))
  expect(fileLink("/Users/me/repo/src/main.ts#L50-L42", folder)).toEqual(lines(42, 50))
})

test("a file named like a scheme, followed by a line, is still a file", () => {
  expect(fileLink("Makefile:12", folder)).toEqual({
    kind: "file",
    path: "Makefile",
    lines: { start: 12, end: 12 },
  })
})

test("a path that leaves the working folder is outside", () => {
  expect(fileLink("/Users/me/.zshrc", folder)).toEqual({
    kind: "outside",
    path: "/Users/me/.zshrc",
  })
  expect(fileLink("/Users/me/repo-other/a.ts", folder)).toEqual({
    kind: "outside",
    path: "/Users/me/repo-other/a.ts",
  })
  expect(fileLink("../other/a.ts", folder)).toEqual({
    kind: "outside",
    path: "/Users/me/other/a.ts",
  })
})

test("a web link, an anchor or the working folder itself is not a file link", () => {
  for (const href of [
    "https://github.com",
    "mailto:a@b.c",
    "vscode://file/a",
    "#usage",
    "",
    "/Users/me/repo",
    "./",
  ])
    expect(fileLink(href, folder)).toEqual({ kind: "none" })
})

test("a file URL or a name followed by a line has a file scheme; a web or script URL has not", () => {
  expect(hasFileScheme("file:///Users/me/repo/a.ts")).toBe(true)
  expect(hasFileScheme("Makefile:12")).toBe(true)
  expect(hasFileScheme("main.ts:42#L1")).toBe(true)
  expect(hasFileScheme("javascript:alert(1)")).toBe(false)
  expect(hasFileScheme("https://github.com")).toBe(false)
  expect(hasFileScheme("http://localhost:3000")).toBe(false)
  expect(hasFileScheme("src/main.ts")).toBe(false)
})
