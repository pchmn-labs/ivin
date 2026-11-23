import { mkdtempSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Rpcs } from "@ivin/contracts/rpcs"
import type { Session } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  layerScripted,
  scriptedLater,
  type ScriptedElement,
  type ScriptedOptions,
} from "@ivin/harness"
import { Deferred, type Duration, Effect, Layer } from "effect"
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
import { trustEveryFolder } from "./trust-every-folder.ts"

const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })
const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const asked: HarnessOutput = {
  type: "approval_request",
  requestId: "r1",
  toolCallId: "t1",
  name: "ls",
  input: { path: "." },
  raw: null,
}
const turn: ScriptedElement[] = [running, said("hi"), idle]

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return db
}

// The scripted agent and the server's fibers run on the test clock; only the polling waits in real time.
const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  limit: Duration.Input,
  options: ScriptedOptions,
  use: (client: Client) => Effect.Effect<A, E, TestClock.TestClock>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(
            layerServicesWith(layerSessionRunsWith("10 seconds", Effect.succeed(limit))),
          ),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted(turns, { reportSession: true, ...options })),
        ),
      ),
      Effect.provide(TestClock.layer()),
      Effect.scoped,
    ),
  )

const realWait = (millis: number) =>
  Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, millis)))

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400; attempt++) {
      const value = yield* read
      if (done(value)) return value
      yield* realWait(5)
    }
    return yield* Effect.die("The condition was never met")
  })

const untilSession = (client: Client, id: string, done: (session: Session) => boolean) =>
  until(
    client["session.list"]({ projectPath: "/p" }).pipe(
      Effect.map((sessions) => sessions.find((s) => s.id === id)!),
    ),
    done,
  )

const typesOf = (db: DatabaseSync, sessionId: string) =>
  (
    db
      .prepare("SELECT type FROM transcript_events WHERE session_id = ? ORDER BY sequence")
      .all(sessionId) as { type: string }[]
  ).map((row) => row.type)

const untilCount = (db: DatabaseSync, sessionId: string, type: string, count: number) =>
  until(
    Effect.sync(() => typesOf(db, sessionId).filter((t) => t === type).length),
    (found) => found >= count,
  )

const untilClosed = (closed: string[], sessionId: string) =>
  until(
    Effect.sync(() => closed),
    (all) => all.includes(sessionId),
  )

// A stop that should not happen has had every chance to show by then.
const settle = realWait(30)

const send = (client: Client, sessionId: string, messageId: string) =>
  client["session.sendMessage"]({ sessionId, messageId, text: "go" })

test("an agent idle for the limit is stopped and its session stays idle, with nothing added to the transcript", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(db, [turn], "10 minutes", { closed }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      const before = typesOf(db, session.id)
      yield* TestClock.adjust("9 minutes")
      yield* settle
      const early = [...closed]
      yield* TestClock.adjust("1 minute")
      yield* untilClosed(closed, session.id)
      const after = yield* untilSession(client, session.id, (s) => s.status === "idle")
      return { early, status: after.status, before, types: typesOf(db, session.id) }
    }),
  )
  expect(result.early).toEqual([])
  expect(result.status).toBe("idle")
  expect(result.types).toEqual(result.before)
})

test("the next message after an idle stop starts a new agent with the stored provider session id", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const starts: ScriptedOptions["starts"] = []
  const result = await withServer(db, [turn, turn], "10 minutes", { closed, starts }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      yield* TestClock.adjust("10 minutes")
      yield* untilClosed(closed, session.id)
      yield* send(client, session.id, "m2")
      yield* untilCount(db, session.id, "assistant_text", 2)
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      return starts!.map((start) => start.providerSessionId)
    }),
  )
  expect(result).toEqual([null, expect.stringMatching(/^scripted-/)])
})

test("a turn in progress keeps its agent running however long it lasts", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(
    db,
    [[running, said("working")]],
    "10 minutes",
    { closed },
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, session.id, "m1")
        yield* untilCount(db, session.id, "assistant_text", 1)
        yield* TestClock.adjust("3 hours")
        yield* settle
        return [...closed]
      }),
  )
  expect(result).toEqual([])
})

test("an open approval keeps the agent running, and the count starts once the turn ends", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(
    db,
    [[running, asked, said("done"), idle]],
    "10 minutes",
    { closed },
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, session.id, "m1")
        yield* untilSession(client, session.id, (s) => s.status === "waiting")
        yield* TestClock.adjust("1 hour")
        yield* settle
        const whileOpen = [...closed]
        yield* client["session.answerApproval"]({
          sessionId: session.id,
          requestId: "r1",
          allow: true,
        })
        yield* untilSession(client, session.id, (s) => s.status === "idle")
        yield* TestClock.adjust("9 minutes")
        yield* settle
        const early = [...closed]
        yield* TestClock.adjust("1 minute")
        yield* untilClosed(closed, session.id)
        return { whileOpen, early }
      }),
  )
  expect(result).toEqual({ whileOpen: [], early: [] })
})

test("a pending message keeps the agent running", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(db, [turn], "10 minutes", { closed }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      db.prepare("UPDATE sessions SET pending_messages = ? WHERE id = ?").run(
        JSON.stringify([{ id: "m2", text: "later", images: [] }]),
        session.id,
      )
      yield* TestClock.adjust("1 hour")
      yield* settle
      return [...closed]
    }),
  )
  expect(result).toEqual([])
})

test("a turn the agent starts on its own restarts the count", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const gate = Effect.runSync(Deferred.make<void>())
  const own: HarnessOutput[] = [running, said("again"), idle]
  const result = await withServer(
    db,
    [[...turn, scriptedLater(gate, own)]],
    "10 minutes",
    { closed },
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, session.id, "m1")
        yield* untilSession(client, session.id, (s) => s.status === "idle")
        yield* TestClock.adjust("6 minutes")
        yield* Deferred.succeed(gate, undefined)
        yield* untilCount(db, session.id, "assistant_text", 2)
        yield* untilSession(client, session.id, (s) => s.status === "idle")
        yield* TestClock.adjust("6 minutes")
        yield* settle
        const early = [...closed]
        yield* TestClock.adjust("4 minutes")
        yield* untilClosed(closed, session.id)
        return { early }
      }),
  )
  expect(result.early).toEqual([])
})

test("a limit of 0 never stops an agent", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(db, [turn], 0, { closed }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "idle")
      yield* TestClock.adjust("30 days")
      yield* settle
      return [...closed]
    }),
  )
  expect(result).toEqual([])
})

test("an agent whose session is in background is not stopped for being idle", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const task: HarnessOutput = {
    type: "task_started",
    taskId: "k1",
    toolCallId: "call-k1",
    kind: "command",
    description: "Dev server",
    raw: null,
  }
  const result = await withServer(db, [[running, task, idle]], "10 minutes", { closed }, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, session.id, "m1")
      yield* untilSession(client, session.id, (s) => s.status === "in_background")
      yield* TestClock.adjust("1 hour")
      yield* settle
      return [...closed]
    }),
  )
  expect(result).toEqual([])
})
