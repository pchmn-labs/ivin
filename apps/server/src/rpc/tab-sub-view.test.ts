import { Rpcs } from "@ivin/contracts/rpcs"
import type { SubView } from "@ivin/contracts/tab"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, beforeEach, expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" }).trim()

let root: string
let project: string

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-subviews-")))
  project = join(root, "project")
  git(root, "init", "--quiet", "-b", "main", project)
  writeFileSync(join(project, "a.txt"), "a")
  git(project, "add", "a.txt")
  git(project, "commit", "--quiet", "-m", "first")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return db
}

const withServer = <A, E>(db: DatabaseSync, use: (client: Client) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(Layer.succeed(ImageFolder)({ path: join(root, "images") })),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([], { starts: [], closed: [] })),
        ),
      ),
      Effect.scoped,
    ),
  )

const file = (path: string): SubView => ({ kind: "file", path })

const newTab = (client: Client) =>
  Effect.gen(function* () {
    yield* client["project.open"]({ path: project })
    const { id } = yield* client["session.create"]({ projectPath: project })
    yield* client["tab.open"]({ sessionId: id })
    return id
  })

test("a new tab has no sub-view", async () => {
  const listed = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      return yield* client["tab.listSubViews"]({ sessionId: yield* newTab(client) })
    }),
  )

  expect(listed).toMatchObject({ subViews: [], selected: null })
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

test("sub-views and the selected one are back after a restart on the same database", async () => {
  const db = newDatabase()
  const sessionId = await withServer(db, (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      for (const path of ["a", "b", "c"]) {
        yield* client["tab.openSubView"]({ sessionId, subView: file(path) })
      }
      yield* client["tab.openSubView"]({ sessionId, subView: file("b") })
      return sessionId
    }),
  )

  const listed = await withServer(db, (client) => client["tab.listSubViews"]({ sessionId }))

  expect(listed.subViews).toEqual([file("a"), file("b"), file("c")])
  expect(listed.selected).toEqual(file("b"))
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

test("closing the tab drops its sub-views", async () => {
  const listed = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = yield* newTab(client)
      yield* client["tab.openSubView"]({ sessionId, subView: file("a.txt") })
      yield* client["tab.close"]({ sessionId })
      yield* client["tab.open"]({ sessionId })
      return yield* client["tab.listSubViews"]({ sessionId })
    }),
  )

  expect(listed).toMatchObject({ subViews: [], selected: null })
})

test("the sub-view RPCs fail for an unknown session", async () => {
  const errors = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const sessionId = "nope"
      return [
        yield* Effect.flip(client["tab.listSubViews"]({ sessionId })),
        yield* Effect.flip(client["tab.openSubView"]({ sessionId, subView: file("a") })),
        yield* Effect.flip(client["tab.closeSubView"]({ sessionId, subView: file("a") })),
      ].map((error) => error._tag)
    }),
  )

  expect(errors).toEqual(Array(3).fill("SessionNotFound"))
})
