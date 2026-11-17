import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { DateTime, Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { TestClock } from "effect/testing"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { handlers, layerServices } from "./handlers.ts"

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
          Layer.provide(layerScripted([])),
        ),
      ),
      Effect.scoped,
    ),
  )
const makeClient = () => RpcTest.makeClient(Rpcs)

test("project.getCurrent is null before any project was opened", async () => {
  expect(await withServer(newDatabase(), (client) => client["project.getCurrent"]())).toBeNull()
})

test("project.open returns the project and project.getCurrent gives it back", async () => {
  const { opened, current } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const opened = yield* client["project.open"]({ path: "/Users/paul/Dev/ivin/" })
      return { opened, current: yield* client["project.getCurrent"]() }
    }),
  )

  expect(opened.name).toBe("ivin")
  expect(opened.path).toBe("/Users/paul/Dev/ivin/")
  expect(current).toEqual(opened)
})

test("the last opened project is current again after the server restarts on the same database", async () => {
  const db = newDatabase()
  await withServer(db, (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* TestClock.adjust(1000)
      yield* client["project.open"]({ path: "/a/second" })
    }).pipe(Effect.provide(TestClock.layer())),
  )

  const current = await withServer(db, (client) => client["project.getCurrent"]())

  expect(current?.path).toBe("/a/second")
})

test("reopening a known project makes it current again with a later time", async () => {
  const { first, current } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const first = yield* client["project.open"]({ path: "/a/first" })
      yield* TestClock.adjust(1000)
      yield* client["project.open"]({ path: "/a/second" })
      yield* TestClock.adjust(1000)
      yield* client["project.open"]({ path: "/a/first" })
      return { first, current: yield* client["project.getCurrent"]() }
    }).pipe(Effect.provide(TestClock.layer())),
  )

  expect(current?.path).toBe("/a/first")
  expect(DateTime.toEpochMillis(current!.lastOpenedAt)).toBe(
    DateTime.toEpochMillis(first.lastOpenedAt) + 2000,
  )
})
