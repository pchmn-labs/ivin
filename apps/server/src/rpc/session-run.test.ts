import { mkdtempSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Rpcs } from "@ivin/contracts/rpcs"
import type { Session } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedElement, type ScriptedOptions } from "@ivin/harness"
import { Deferred, type Duration, Effect, Fiber, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { TestClock } from "effect/testing"
import { expect, test } from "vitest"
import { layerSessionRunsWith } from "../modules/session/usecases/session-runs.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServicesWith } from "./handlers.ts"
import { until } from "./test-waits.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })
const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const turn: ScriptedElement[] = [running, said("hi"), idle]
const working: ScriptedElement[] = [running, said("working")]

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return db
}

const serverLayer = (
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  { deadline = "20 millis", ...options }: ScriptedOptions & { deadline?: Duration.Input },
) =>
  handlers.pipe(
    Layer.provide(layerServicesWith(layerSessionRunsWith(deadline))),
    Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
    Layer.provide(Layer.succeed(Database)(db)),
    Layer.provide(layerKeybindingsFileOf([])),
    Layer.provide(layerSettingsFileOf([])),
    Layer.provide(
      Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
    ),
    Layer.provide(layerScripted(turns, { reportSession: true, ...options })),
  )

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  options: ScriptedOptions & { deadline?: Duration.Input },
  use: (client: Client) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(serverLayer(db, turns, options)),
      Effect.scoped,
    ),
  )

const withTestClock = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  options: ScriptedOptions & { deadline?: Duration.Input },
  use: (client: Client) => Effect.Effect<A, E, TestClock.TestClock>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(serverLayer(db, turns, options)),
      Effect.provide(TestClock.layer()),
      Effect.scoped,
    ),
  )

const untilSession = (client: Client, id: string, done: (session: Session) => boolean) =>
  until(
    client["session.list"]({ projectPath: "/p" }).pipe(
      Effect.map((sessions) => sessions.find((s) => s.id === id)!),
    ),
    done,
  )

const newGate = () => ({
  reached: Effect.runSync(Deferred.make<void>()),
  release: Effect.runSync(Deferred.make<void>()),
})

const typesOf = (db: DatabaseSync, sessionId: string) =>
  (
    db
      .prepare("SELECT type FROM transcript_events WHERE session_id = ? ORDER BY sequence")
      .all(sessionId) as { type: string }[]
  ).map((row) => row.type)

const untilTypes = (db: DatabaseSync, sessionId: string, type: string) =>
  until(
    Effect.sync(() => typesOf(db, sessionId)),
    (types) => types.includes(type),
  )

const untilClosed = (closed: string[], sessionId: string) =>
  until(
    Effect.sync(() => closed),
    (all) => all.includes(sessionId),
  )

const send = (client: Client, sessionId: string, messageId: string) =>
  client["session.sendMessage"]({ sessionId, messageId, text: "go" })

test("a message whose client stopped waiting while the agent started still runs its turn", async () => {
  const db = newDatabase()
  const startGate = newGate()
  const types = await withServer(db, [turn], { startGate }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const sending = yield* send(client, session.id, "m1").pipe(Effect.forkChild)
      yield* Deferred.await(startGate.reached)
      yield* Effect.forkChild(Fiber.interrupt(sending))
      yield* Deferred.succeed(startGate.release, undefined)
      yield* untilTypes(db, session.id, "assistant_text")
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      return typesOf(db, session.id)
    }),
  )
  expect(types).toContain("user_message")
})

test("a database error while a run writes the transcript stops the agent, fails the session and lets the next message start a new run", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const starts: ScriptedOptions["starts"] = []
  const result = await withServer(db, [turn, turn], { closed, starts }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      db.exec(
        "CREATE TRIGGER refuse BEFORE INSERT ON transcript_events WHEN NEW.type = 'assistant_text' BEGIN SELECT RAISE(ABORT, 'refused'); END",
      )
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "failed")
      yield* untilClosed(closed, session.id)
      db.exec("DROP TRIGGER refuse")
      yield* send(client, session.id, "m2")
      yield* untilTypes(db, session.id, "assistant_text")
      const after = yield* untilSession(client, session.id, (s) => s.status === "idle")
      return { status: after.status, starts: starts.length }
    }),
  )
  expect(result).toEqual({ status: "idle", starts: 2 })
})

test("deleting a session while its agent starts stops the agent once the message is sent", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const startGate = newGate()
  const remaining = await withServer(db, [turn], { closed, startGate }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1").pipe(Effect.forkChild)
      yield* Deferred.await(startGate.reached)
      yield* client["session.delete"]({ sessionId: session.id }).pipe(Effect.forkChild)
      yield* Deferred.succeed(startGate.release, undefined)
      yield* untilClosed(closed, session.id)
      return yield* until(
        client["session.list"]({ projectPath: "/p" }),
        (sessions) => sessions.length === 0,
      )
    }),
  )
  expect(remaining).toEqual([])
})

test("archiving a session while its agent starts leaves it idle with no agent", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const startGate = newGate()
  const archived = await withServer(db, [turn], { closed, startGate }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1").pipe(Effect.forkChild)
      yield* Deferred.await(startGate.reached)
      yield* client["session.archive"]({ sessionId: session.id }).pipe(Effect.forkChild)
      yield* Deferred.succeed(startGate.release, undefined)
      yield* untilClosed(closed, session.id)
      const [stored] = yield* until(
        client["session.listArchived"]({ projectPath: "/p" }),
        (sessions) => sessions.length > 0,
      )
      return stored!
    }),
  )
  expect(archived.status).toBe("idle")
})

test("an interrupt the agent ignores stops its process, records an interruption and sets the session idle", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(db, [working], { closed, ignoreInterrupt: true }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilTypes(db, session.id, "assistant_text")
      yield* client["session.interrupt"]({ sessionId: session.id })
      yield* untilClosed(closed, session.id)
      const stopped = yield* untilSession(client, session.id, (s) => s.status === "idle")
      return { status: stopped.status, last: typesOf(db, session.id).at(-1) }
    }),
  )
  expect(result).toEqual({ status: "idle", last: "interruption" })
})

test("an interrupt the agent honours does not stop its process", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const interrupted: string[] = []
  const result = await withTestClock(
    db,
    [working],
    { closed, interrupted, deadline: "250 millis" },
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, session.id, "m1")
        yield* untilTypes(db, session.id, "assistant_text")
        yield* client["session.interrupt"]({ sessionId: session.id })
        yield* untilTypes(db, session.id, "interruption")
        yield* untilSession(client, session.id, (s) => s.status === "idle")
        yield* TestClock.adjust("500 millis")
        return { closed: closed.length, interrupted: interrupted.length }
      }),
  )
  expect(result).toEqual({ closed: 0, interrupted: 1 })
})
