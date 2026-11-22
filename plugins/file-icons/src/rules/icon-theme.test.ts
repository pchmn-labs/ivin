import { expect, test } from "vitest"
import { iconPathOf, indexTheme, type IconTheme } from "./icon-theme.ts"

const theme: IconTheme = {
  iconDefinitions: Object.fromEntries(
    [
      "file",
      "folder",
      "folder-open",
      "nodejs",
      "typescript",
      "test-ts",
      "perl",
      "folder-src",
      "folder-src-open",
      "nodejs-light",
      "folder-src-light",
    ].map((id) => [id, { iconPath: `./../icons/${id}.svg` }]),
  ),
  file: "file",
  folder: "folder",
  folderExpanded: "folder-open",
  fileNames: { "package.json": "nodejs" },
  fileExtensions: { ts: "typescript", "test.ts": "test-ts", "package.json": "typescript" },
  languageIds: { perl: "perl", typescript: "nodejs" },
  folderNames: { src: "folder-src" },
  folderNamesExpanded: { src: "folder-src-open" },
  light: {
    fileNames: { "package.json": "nodejs-light" },
    folderNames: { src: "folder-src-light" },
  },
}
const index = indexTheme(theme, { p6: "perl", ts: "typescript" })
const file = (name: string, light = false) =>
  iconPathOf(index, { name, folder: false, open: false }, light)
const folder = (name: string, open: boolean, light = false) =>
  iconPathOf(index, { name, folder: true, open }, light)

test("a file's icon comes from its name first, ignoring case", () => {
  expect(file("Package.JSON")).toBe("icons/nodejs.svg")
})

test("then from its longest matching extension", () => {
  expect(file("app.test.ts")).toBe("icons/test-ts.svg")
  expect(file("main.ts")).toBe("icons/typescript.svg")
})

test("then from the language of its extension, then the theme's file icon", () => {
  expect(file("grammar.p6")).toBe("icons/perl.svg")
  expect(file("notes.unknown")).toBe("icons/file.svg")
  expect(file("Makefile")).toBe("icons/file.svg")
})

test("a folder's icon comes from its name, open or closed, else the theme's folder icons", () => {
  expect(folder("src", false)).toBe("icons/folder-src.svg")
  expect(folder("SRC", true)).toBe("icons/folder-src-open.svg")
  expect(folder("stuff", false)).toBe("icons/folder.svg")
  expect(folder("stuff", true)).toBe("icons/folder-open.svg")
})

test("the light theme takes the theme's light entries, and the others where it has none", () => {
  expect(file("package.json", true)).toBe("icons/nodejs-light.svg")
  expect(folder("src", false, true)).toBe("icons/folder-src-light.svg")
  expect(folder("src", true, true)).toBe("icons/folder-src-open.svg")
  expect(file("main.ts", true)).toBe("icons/typescript.svg")
})

test("an icon the theme does not define gives nothing", () => {
  const broken = indexTheme({ ...theme, file: "missing" }, {})
  expect(iconPathOf(broken, { name: "a.zzz", folder: false, open: false }, false)).toBeNull()
})
