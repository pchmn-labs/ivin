import type { ProjectPlugin, ProjectPluginChange, ProjectPlugins } from "@ivin/contracts/plugin"
import { expect, test } from "vitest"
import { diffLines, unseenChanges, waitingPlugins } from "./project-plugin-queue.ts"

const plugin = (id: string, state: ProjectPlugin["state"]): ProjectPlugin => ({
  id,
  name: id,
  state,
  hash: `hash-${id}`,
  files: [],
  diff: "",
  permissionsChanged: false,
  permissions: [],
})

const change = (id: string, seen: boolean): ProjectPluginChange => ({
  id,
  name: id,
  hash: "h",
  at: 0,
  isNew: false,
  files: [],
  diff: "",
  seen,
})

const project = (path: string, plugins: ProjectPlugin[], changes: ProjectPluginChange[] = []) =>
  ({
    project: path,
    projectName: path,
    openAs: [],
    fullTrust: false,
    plugins,
    changes,
  }) satisfies ProjectPlugins

test("only the plugins of the project on screen that wait for trust are waiting", () => {
  const projects = [
    project("/a", [plugin("one", "trusted"), plugin("two", "new"), plugin("three", "changed")]),
    project("/b", [plugin("other", "new")]),
  ]
  expect(waitingPlugins(projects, "/a").map((p) => p.id)).toEqual(["two", "three"])
  expect(waitingPlugins(projects, "/c")).toEqual([])
})

test("a project the window opened by a path that resolves to the trusted folder still matches", () => {
  const aliased = { ...project("/private/a", [plugin("two", "new")]), openAs: ["/a"] }
  expect(waitingPlugins([aliased], "/a").map((p) => p.id)).toEqual(["two"])
})

test("only the changes the user has not marked as read are unseen", () => {
  const state = project("/a", [], [change("x", true), change("y", false)])
  expect(unseenChanges(state).map((c) => c.id)).toEqual(["y"])
})

test("a unified diff splits into the file, hunk, added, removed and context lines", () => {
  const lines = diffLines(
    "diff --git a/server.ts b/server.ts\n--- a/server.ts\n+++ b/server.ts\n@@ -1,2 +1,2 @@\n keep\n-old\n+new\n",
  )
  expect(lines.map((line) => line.kind)).toEqual([
    "file",
    "file",
    "file",
    "hunk",
    "context",
    "removed",
    "added",
  ])
  expect(lines.at(-1)?.text).toBe("+new")
})

test("a removed line that starts with dashes after a hunk header is a removed line, not a file header", () => {
  const lines = diffLines("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-- a comment\n++ b\n")
  expect(lines.map((line) => line.kind)).toEqual(["file", "file", "hunk", "removed", "added"])
})
