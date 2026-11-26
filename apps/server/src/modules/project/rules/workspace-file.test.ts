import { expect, test } from "vitest"
import { isWorkspaceFile, workspaceFolders, workspaceName } from "./workspace-file.ts"

test("lists the folders in the file's order, relative ones from the file's folder", () => {
  const text = `{
    // the code
    "folders": [{ "path": "api" }, { "path": "/abs/web", "name": "Web" }, { "path": "../shared", },],
    "settings": {}
  }`
  expect(workspaceFolders(text, "/work/ivin.code-workspace")).toEqual([
    "/work/api",
    "/abs/web",
    "/shared",
  ])
})

test("skips a folder given as a uri and a duplicate", () => {
  const text = `{ "folders": [{ "uri": "vscode-remote://x/y" }, { "path": "a" }, { "path": "./a" }] }`
  expect(workspaceFolders(text, "/w/x.code-workspace")).toEqual(["/w/a"])
})

test("is null for a file that is not a workspace", () => {
  expect(workspaceFolders("not json", "/w/x.code-workspace")).toBeNull()
  expect(workspaceFolders(`{ "settings": {} }`, "/w/x.code-workspace")).toBeNull()
})

test("names the workspace after its file", () => {
  expect(isWorkspaceFile("/w/ivin.code-workspace")).toBe(true)
  expect(isWorkspaceFile("/w/ivin")).toBe(false)
  expect(workspaceName("/w/ivin.code-workspace")).toBe("ivin")
})
