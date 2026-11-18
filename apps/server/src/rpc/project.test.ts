import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return db
}

const withServer = <A, E>(
  db: DatabaseSync,
  use: (client: Effect.Success<ReturnType<typeof makeClient>>) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerScripted([])),
        ),
      ),
      Effect.scoped,
    ),
  )
const makeClient = () => RpcTest.makeClient(Rpcs)

test("nothing is open on a new database", async () => {
  const open = await withServer(newDatabase(), (client) => client["project.list"]())

  expect(open).toEqual({ projects: [], selectedPath: null })
})

test("opening two projects lists them in order with the last one selected", async () => {
  const open = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/Users/paul/Dev/ivin/" })
      return yield* client["project.open"]({ path: "/a/second" })
    }),
  )

  expect(open.projects.map((p) => [p.path, p.name])).toEqual([
    ["/Users/paul/Dev/ivin/", "ivin"],
    ["/a/second", "second"],
  ])
  expect(open.selectedPath).toBe("/a/second")
})

test("opening an open project keeps its place and selects it", async () => {
  const open = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/second" })
      return yield* client["project.open"]({ path: "/a/first" })
    }),
  )

  expect(open.projects.map((p) => p.path)).toEqual(["/a/first", "/a/second"])
  expect(open.selectedPath).toBe("/a/first")
})

test("selecting an open project selects it, and a project that is not open fails", async () => {
  const { selected, error } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/second" })
      const selected = yield* client["project.select"]({ path: "/a/first" })
      const error = yield* Effect.flip(client["project.select"]({ path: "/a/none" }))
      return { selected, error }
    }),
  )

  expect(selected.selectedPath).toBe("/a/first")
  expect(error._tag).toBe("ProjectNotOpen")
})

test.each([
  ["a selected project selects the next one", "/a/b", "/a/c"],
  ["the selected last project selects the previous one", "/a/c", "/a/b"],
  ["an unselected project leaves the selection", "/a/a", "/a/b"],
])("closing %s", async (_, closed, expectedSelected) => {
  const open = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      for (const path of ["/a/a", "/a/b", "/a/c"]) yield* client["project.open"]({ path })
      yield* client["project.select"]({ path: closed === "/a/a" ? "/a/b" : closed })
      return yield* client["project.close"]({ path: closed })
    }),
  )

  expect(open.projects.map((p) => p.path)).not.toContain(closed)
  expect(open.selectedPath).toBe(expectedSelected)
})

test("closing the only project selects none, and a project that is not open fails", async () => {
  const { open, error } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const open = yield* client["project.close"]({ path: "/a/first" })
      const error = yield* Effect.flip(client["project.close"]({ path: "/a/first" }))
      return { open, error }
    }),
  )

  expect(open).toEqual({ projects: [], selectedPath: null })
  expect(error._tag).toBe("ProjectNotOpen")
})

test("closing a project closes its tabs and keeps its sessions", async () => {
  const { sessions, tabs } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const session = yield* client["session.create"]({ projectPath: "/a/first", model: "sonnet" })
      yield* client["tab.open"]({ sessionId: session.id })
      yield* client["project.close"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/first" })
      return {
        sessions: yield* client["session.list"]({ projectPath: "/a/first" }),
        tabs: yield* client["tab.list"]({ projectPath: "/a/first" }),
      }
    }),
  )

  expect(sessions).toHaveLength(1)
  expect(tabs).toEqual({ projectPath: "/a/first", tabs: [], selectedSessionId: null })
})

test("open projects, their order and the selection are back after a restart on the same database", async () => {
  const db = newDatabase()
  await withServer(db, (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/second" })
      yield* client["project.open"]({ path: "/a/third" })
      yield* client["project.close"]({ path: "/a/third" })
      yield* client["project.select"]({ path: "/a/first" })
    }),
  )

  const open = await withServer(db, (client) => client["project.list"]())

  expect(open.projects.map((p) => p.path)).toEqual(["/a/first", "/a/second"])
  expect(open.selectedPath).toBe("/a/first")
})
