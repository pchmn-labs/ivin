import type { SubView } from "@ivin/contracts/tab"
import { Effect, Layer } from "effect"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { beforeEach, expect, test, vi } from "vitest"
import { git, useClonedProject } from "./git-fixture.ts"
import { makeClient, newDatabase, serverLayer, type Client } from "./test-server.ts"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"

// Real git: over 1 s when the suite runs other git tests beside it.
vi.setConfig({ testTimeout: 5000 })

const fixture = useClonedProject()
let root = ""
let project = ""
beforeEach(() => {
  root = fixture.root
  project = fixture.project
})

const withServer = <A, E>(db: DatabaseSync, use: (client: Client) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        Layer.provide(
          serverLayer({
            db,
            imageFolder: join(root, "images"),
            scripted: { starts: [], closed: [] },
          }),
          layerFsUserPlugins(join(root, "home")),
        ),
      ),
      Effect.scoped,
    ),
  )

const file = (path: string): SubView => ({ view: "files/file", params: { path } })
const diff = (path: string): SubView => ({
  view: "changes/diff",
  params: { kind: "working", path },
})

const writeViewsPlugin = (views: Record<string, unknown>) => {
  const folder = join(root, "home", "plugins", "terminal")
  mkdirSync(folder, { recursive: true })
  writeFileSync(
    join(folder, "package.json"),
    JSON.stringify({ name: "terminal", ivin: { id: "terminal", ui: "ui.tsx", views } }),
  )
}
const shell = (terminalId: string): SubView => ({ view: "terminal/shell", params: { terminalId } })

const newTab = (client: Client) =>
  Effect.gen(function* () {
    yield* client["project.open"]({ path: project })
    const { id } = yield* client["session.create"]({ projectPath: project })
    yield* client["tab.open"]({ sessionId: id })
    return id
  })

test("the last sub-view opened is selected, and reopening an earlier one only selects it", async () => {
  const { second, again } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      const second = yield* client["tab.openSubView"]({ sessionId, subView: file("src/b.ts") })
      const again = yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      return { second, again }
    }),
  )

  expect(second.subViews).toEqual([file("a.txt"), file("src/b.ts")])
  expect(second.selected).toEqual(file("src/b.ts"))
  expect(again.subViews).toEqual([file("a.txt"), file("src/b.ts")])
  expect(again.selected).toEqual(file("a.txt"))
})

test("closing the selected sub-view selects its neighbour, the previous one when it was last", async () => {
  const { afterFirst, afterLast, afterAll } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      for (const path of ["a", "b", "c"]) {
        yield* client["tab.openSubView"]({ sessionId, subView: file(path) })
      }
      yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      const afterFirst = yield* client["tab.closeSubView"]({ sessionId, subView: file("a") })
      yield* client["tab.openSubView"]({ sessionId, subView: file("c") })
      const afterLast = yield* client["tab.closeSubView"]({ sessionId, subView: file("c") })
      const afterAll = yield* client["tab.closeSubView"]({ sessionId, subView: file("b") })
      return { afterFirst, afterLast, afterAll }
    }),
  )

  expect(afterFirst.subViews).toEqual([file("b"), file("c")])
  expect(afterFirst.selected).toEqual(file("b"))
  expect(afterLast.subViews).toEqual([file("b")])
  expect(afterLast.selected).toEqual(file("b"))
  expect(afterAll).toMatchObject({ subViews: [], selected: null })
})

test("closing a sub-view that is not the selected one keeps the selection, and a missing one changes nothing", async () => {
  const { closed, missing } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      yield* client["tab.openSubView"]({ sessionId, subView: file("b") })
      const closed = yield* client["tab.closeSubView"]({ sessionId, subView: file("a") })
      const missing = yield* client["tab.closeSubView"]({ sessionId, subView: file("zzz") })
      return { closed, missing }
    }),
  )

  expect(closed.selected).toEqual(file("b"))
  expect(missing).toEqual(closed)
})

test("a view that declares restore: false is dropped when the server starts, the others stay", async () => {
  writeViewsPlugin({
    shell: {
      title: "Terminal",
      icon: "terminal",
      placements: ["subView"],
      defaultPlacement: "subView",
      restore: false,
    },
  })
  const db = newDatabase()
  const sessionId = await withServer(db, (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      const opened = yield* client["tab.openSubView"]({ sessionId, subView: shell("t1") })
      expect(opened.subViews).toEqual([file("a"), shell("t1")])
      return sessionId
    }),
  )

  const listed = await withServer(db, (client) => client["tab.listSubViews"]({ sessionId }))

  expect(listed.subViews).toEqual([file("a")])
  expect(listed.selected).toEqual(file("a"))
})

test("a view with a plugin's own parameters is back after a restart", async () => {
  writeViewsPlugin({
    shell: {
      title: "Terminal",
      icon: "terminal",
      placements: ["subView"],
      defaultPlacement: "subView",
    },
  })
  const db = newDatabase()
  const sessionId = await withServer(db, (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: shell("t1") })
      return sessionId
    }),
  )

  const listed = await withServer(db, (client) => client["tab.listSubViews"]({ sessionId }))

  expect(listed.subViews).toEqual([shell("t1")])
  expect(listed.selected).toEqual(shell("t1"))
})

test("moving the session to another working folder closes its sub-views", async () => {
  const other = join(project, ".worktrees", "other")
  git(project, "worktree", "add", "--quiet", "-b", "other", other)
  const { before, after, reopened } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      const before = yield* client["tab.listSubViews"]({ sessionId })
      yield* client["session.pickWorkingFolder"]({
        sessionId,
        workingFolder: { kind: "existing_worktree", path: other },
      })
      const after = yield* client["tab.listSubViews"]({ sessionId })
      const reopened = yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      return { before, after, reopened }
    }),
  )

  expect(before.subViews).toEqual([file("a.txt")])
  expect(after).toMatchObject({ subViews: [], selected: null })
  expect(reopened.subViews).toEqual([file("a.txt")])
})

test("closing the tab drops its sub-views and forgets its full width", async () => {
  const listed = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      yield* client["tab.setFullWidth"]({ sessionId, fullWidth: true })
      yield* client["tab.close"]({ sessionId })
      yield* client["tab.open"]({ sessionId })
      return yield* client["tab.listSubViews"]({ sessionId })
    }),
  )

  expect(listed).toMatchObject({ subViews: [], selected: null, fullWidth: false })
})

test("the sub-view RPCs fail for an unknown session", async () => {
  const errors = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = "nope"
      return [
        yield* Effect.flip(client["tab.listSubViews"]({ sessionId })),
        yield* Effect.flip(client["tab.openSubView"]({ sessionId, subView: file("a") })),
        yield* Effect.flip(client["tab.closeSubView"]({ sessionId, subView: file("a") })),
        yield* Effect.flip(client["tab.setFullWidth"]({ sessionId, fullWidth: true })),
        yield* Effect.flip(client["tab.selectSessionTab"]({ sessionId })),
      ].map((error) => error._tag)
    }),
  )

  expect(errors).toEqual(Array(5).fill("SessionNotFound"))
})

test("sub-views, the selected one, the full width and the Session tab are back after a restart on the same database, a diff beside the file of the same path", async () => {
  const db = newDatabase()
  const { fresh, sessionId } = await withServer(db, (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      const fresh = yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      for (const path of ["b", "c"]) {
        yield* client["tab.openSubView"]({ sessionId, subView: file(path) })
      }
      yield* client["tab.openSubView"]({
        sessionId,
        subView: { view: "changes/diff", params: { path: "a", kind: "working" } },
      })
      yield* client["tab.openSubView"]({ sessionId, subView: diff("a") })
      yield* client["tab.openSubView"]({ sessionId, subView: file("b") })
      yield* client["tab.setFullWidth"]({ sessionId, fullWidth: true })
      yield* client["tab.selectSessionTab"]({ sessionId })
      return { fresh, sessionId }
    }),
  )

  const listed = await withServer(db, (client) => client["tab.listSubViews"]({ sessionId }))

  expect(fresh).toMatchObject({ fullWidth: false, sessionTabSelected: false })
  expect(listed).toMatchObject({
    subViews: [file("a"), file("b"), file("c"), diff("a")],
    selected: file("b"),
    fullWidth: true,
    sessionTabSelected: true,
  })
})

test("opening a sub-view or going back beside the chat leaves the Session tab", async () => {
  const { reopened, beside } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      yield* client["tab.setFullWidth"]({ sessionId, fullWidth: true })
      yield* client["tab.selectSessionTab"]({ sessionId })
      const reopened = yield* client["tab.openSubView"]({ sessionId, subView: file("a") })
      yield* client["tab.selectSessionTab"]({ sessionId })
      const beside = yield* client["tab.setFullWidth"]({ sessionId, fullWidth: false })
      return { reopened, beside }
    }),
  )

  expect(reopened).toMatchObject({
    selected: file("a"),
    fullWidth: true,
    sessionTabSelected: false,
  })
  expect(beside).toMatchObject({ selected: file("a"), fullWidth: false, sessionTabSelected: false })
})
