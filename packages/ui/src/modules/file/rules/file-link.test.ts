import { expect, test } from "vitest"
import { fileLink, hasFileScheme, inlineCodeTarget, type ListedFiles } from "./file-link.ts"

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
  expect(fileLink("/Users/me/.zshrc:11", folder)).toEqual({
    kind: "outside",
    path: "/Users/me/.zshrc",
    lines: { start: 11, end: 11 },
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

const listed = (...paths: Array<string>) => ({ paths: new Set(paths), truncated: false })
const files = listed("src/main.ts", "bin/ivin", "LICENSE", ".env.example", "example.com")
const target = (code: string, listing: ListedFiles = files) =>
  inlineCodeTarget(code, folder, listing).kind

test("inline code naming a listed file, with an optional line, opens it", () => {
  for (const code of [
    "src/main.ts",
    "./src/main.ts",
    "src/main.ts:42",
    "src/main.ts:42:7",
    "src/main.ts:42-50",
    "src/main.ts#L42-L50",
    "bin/ivin",
    "LICENSE",
    ".env.example",
    "example.com",
  ])
    expect(target(code), code).toBe("file")
})

test("an absolute path or a file URL opens on its shape, inside the working folder or not", () => {
  for (const code of [
    "/Users/me/.zshrc",
    "/Users/me/.zshrc:11",
    "/Users/me/repo/src/gone.ts",
    "file:///Users/me/notes.md",
    "../other/a.ts",
  ])
    expect(target(code), code).toBe("file")
})

test("a relative path the list does not hold, a branch or a name stays code", () => {
  for (const code of [
    "origin/main",
    "pchmn-labs/ivin",
    "console.log",
    "process.env",
    "src/old.ts",
    "src",
    "notes.md",
    "run.sh",
    "ivin.app",
    "npm install",
    "foo()",
    "a && b",
    "https://example.com",
    "@types/node",
    "~/.zshrc",
    "1.2.3",
    "PNPM_HOME",
    "std::vector",
    "x = 1",
    "<div>",
    "/",
    "",
  ])
    expect(target(code), code).toBe("code")
})

test("a domain the list does not hold opens as a web link", () => {
  expect(inlineCodeTarget("github.com", folder, files)).toEqual({
    kind: "web",
    url: "https://github.com",
  })
  expect(inlineCodeTarget("github.com/pchmn-labs/ivin", folder, files)).toEqual({
    kind: "web",
    url: "https://github.com/pchmn-labs/ivin",
  })
  expect(target("docs.example.fr/a?b=1")).toBe("web")
  expect(target("Example.COM")).toBe("web")
  expect(target("a@example.com")).toBe("code")
})

test("while the list loads, only an absolute path opens", () => {
  expect(target("src/main.ts", "loading")).toBe("code")
  expect(target("github.com", "loading")).toBe("code")
  expect(target("/Users/me/.zshrc", "loading")).toBe("file")
})

test("when the list is truncated or unreadable, a relative path opens on its shape", () => {
  for (const listing of [{ paths: new Set<string>(), truncated: true }, "unreadable"] as const) {
    expect(target("src/old.ts", listing)).toBe("file")
    expect(target("origin/main", listing)).toBe("file")
    expect(target("LICENSE", listing)).toBe("code")
    expect(target("github.com", listing)).toBe("file")
  }
})
