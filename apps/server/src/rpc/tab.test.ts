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
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newSession = (client: Client, projectPath: string) =>
  client["session.create"]({ projectPath, model: "sonnet" })

test("opening a tab for a session twice yields one tab", async () => {
  const { first, second } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const session = yield* newSession(client, "/a/first")
      const first = yield* client["tab.open"]({ sessionId: session.id })
      return { first, second: yield* client["tab.open"]({ sessionId: session.id }) }
    }),
  )

  expect(second).toEqual(first)
  expect(second.tabs).toHaveLength(1)
  expect(second.selectedSessionId).toBe(second.tabs[0]!.sessionId)
})

test("a new tab goes at the end of its project's bar and is selected; reopening an earlier one only selects it", async () => {
  const { ids, bar, again } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const ids: string[] = []
      for (let i = 0; i < 3; i++) ids.push((yield* newSession(client, "/a/first")).id)
      let bar
      for (const sessionId of ids) bar = yield* client["tab.open"]({ sessionId })
      return { ids, bar: bar!, again: yield* client["tab.open"]({ sessionId: ids[0]! }) }
    }),
  )

  expect(bar.tabs.map((t) => t.sessionId)).toEqual(ids)
  expect(bar.selectedSessionId).toBe(ids[2])
  expect(again.tabs.map((t) => t.sessionId)).toEqual(ids)
  expect(again.selectedSessionId).toBe(ids[0])
})

test("a tab of another project goes to that project's bar", async () => {
  const { a, b } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/second" })
      yield* client["tab.open"]({ sessionId: (yield* newSession(client, "/a/first")).id })
      yield* client["tab.open"]({ sessionId: (yield* newSession(client, "/a/second")).id })
      return {
        a: yield* client["tab.list"]({ projectPath: "/a/first" }),
        b: yield* client["tab.list"]({ projectPath: "/a/second" }),
      }
    }),
  )

  expect(a.tabs.map((t) => t.projectPath)).toEqual(["/a/first"])
  expect(b.tabs.map((t) => t.projectPath)).toEqual(["/a/second"])
})

test("opening a tab fails for an unknown session and for a project that is not open", async () => {
  const { unknown, closed } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const session = yield* newSession(client, "/a/never-opened")
      return {
        unknown: yield* Effect.flip(client["tab.open"]({ sessionId: "nope" })),
        closed: yield* Effect.flip(client["tab.open"]({ sessionId: session.id })),
      }
    }),
  )

  expect(unknown._tag).toBe("SessionNotFound")
  expect(closed._tag).toBe("ProjectNotOpen")
})

const barOf = (client: Client, count: number) =>
  Effect.gen(function* () {
    yield* client["project.open"]({ path: "/a/first" })
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const session = yield* newSession(client, "/a/first")
      yield* client["tab.open"]({ sessionId: session.id })
      ids.push(session.id)
    }
    return ids
  })

test("reordering puts the named tabs first and keeps the others after them", async () => {
  const { ids, reordered } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 4)
      const reordered = yield* client["tab.reorder"]({
        projectPath: "/a/first",
        sessionIds: [ids[2]!, ids[0]!],
      })
      return { ids, reordered }
    }),
  )

  expect(reordered.tabs.map((t) => t.sessionId)).toEqual([ids[2], ids[0], ids[1], ids[3]])
})

test.each([
  ["a selected tab selects the next one", 1, 2],
  ["the selected last tab selects the previous one", 2, 1],
])("closing %s", async (_, closing, expected) => {
  const { ids, closed } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 3)
      yield* client["tab.open"]({ sessionId: ids[closing]! })
      return { ids, closed: yield* client["tab.close"]({ sessionId: ids[closing]! }) }
    }),
  )

  expect(closed.tabs.map((t) => t.sessionId)).not.toContain(ids[closing])
  expect(closed.selectedSessionId).toBe(ids[expected])
})

test("closing an unselected tab keeps the selection, and closing the last tab selects none", async () => {
  const { kept, none } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 2)
      const kept = yield* client["tab.close"]({ sessionId: ids[0]! })
      const none = yield* client["tab.close"]({ sessionId: ids[1]! })
      return { kept: { ...kept, last: ids[1] }, none }
    }),
  )

  expect(kept.selectedSessionId).toBe(kept.last)
  expect(none.tabs).toEqual([])
  expect(none.selectedSessionId).toBeNull()
})

test("closing a tab of an unknown session fails", async () => {
  const error = await withServer(newDatabase(), (client) =>
    Effect.flip(client["tab.close"]({ sessionId: "nope" })),
  )

  expect(error._tag).toBe("SessionNotFound")
})

test("tabs, their order and each project's selected tab are back after a restart on the same database", async () => {
  const db = newDatabase()
  const ids = await withServer(db, (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 3)
      yield* client["tab.reorder"]({ projectPath: "/a/first", sessionIds: [ids[2]!, ids[1]!] })
      yield* client["tab.open"]({ sessionId: ids[1]! })
      yield* client["project.open"]({ path: "/a/second" })
      const other = yield* newSession(client, "/a/second")
      yield* client["tab.open"]({ sessionId: other.id })
      return { ids, other: other.id }
    }),
  )

  const { first, second, open } = await withServer(db, (client) =>
    Effect.gen(function* () {
      return {
        first: yield* client["tab.list"]({ projectPath: "/a/first" }),
        second: yield* client["tab.list"]({ projectPath: "/a/second" }),
        open: yield* client["project.list"](),
      }
    }),
  )

  expect(first.tabs.map((t) => t.sessionId)).toEqual([ids.ids[2], ids.ids[1], ids.ids[0]])
  expect(first.selectedSessionId).toBe(ids.ids[1])
  expect(second.tabs.map((t) => t.sessionId)).toEqual([ids.other])
  expect(second.selectedSessionId).toBe(ids.other)
  expect(open.selectedPath).toBe("/a/second")
})
