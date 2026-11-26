import type { DatabaseSync } from "node:sqlite"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { scriptedLater, type ScriptedElement, type ScriptedOptions } from "@ivin/harness"
import { Deferred, type Duration, Effect } from "effect"
import { TestClock } from "effect/testing"
import { expect, test } from "vitest"
import {
  askedApproval as asked,
  idle,
  running,
  said,
  send,
  typesOf,
  untilClosed,
  untilSession,
} from "./test-scripts.ts"
import { makeClient, newDatabase, serverLayer, type Client } from "./test-server.ts"
import { layerSessionRunsWith } from "../modules/session/usecases/session-runs.ts"
import { layerServicesWith } from "./handlers.ts"
import { until } from "./test-waits.ts"

const turn: ScriptedElement[] = [running, said("hi"), idle]

// The scripted agent and the server's fibers run on the test clock; TestClock.adjust returns once the fibers it woke have settled.
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
        serverLayer({
          db,
          turns,
          scripted: { reportSession: true, ...options },
          services: layerServicesWith(layerSessionRunsWith("10 seconds", Effect.succeed(limit))),
        }),
      ),
      Effect.provide(TestClock.layer()),
      Effect.scoped,
    ),
  )

const untilCount = (db: DatabaseSync, sessionId: string, type: string, count: number) =>
  until(
    Effect.sync(() => typesOf(db, sessionId).filter((t) => t === type).length),
    (found) => found >= count,
  )

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
      return starts.map((start) => start.providerSessionId)
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
        const whileOpen = [...closed]
        yield* client["session.answerApproval"]({
          sessionId: session.id,
          requestId: "r1",
          allow: true,
        })
        yield* untilSession(client, session.id, (s) => s.status === "idle")
        yield* TestClock.adjust("9 minutes")
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
      return [...closed]
    }),
  )
  expect(result).toEqual([])
})
