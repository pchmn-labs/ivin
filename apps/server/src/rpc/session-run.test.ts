import type { DatabaseSync } from "node:sqlite"
import type { ScriptedElement, ScriptedOptions } from "@ivin/harness"
import { Deferred, type Duration, Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { expect, test } from "vitest"
import { idle, running, said, send, typesOf, untilClosed, untilSession } from "./test-scripts.ts"
import {
  makeClient,
  newDatabase,
  serverLayer,
  withServer as withTestServer,
  type Client,
} from "./test-server.ts"
import { layerSessionRunsWith } from "../modules/session/usecases/session-runs.ts"
import { layerServicesWith } from "./handlers.ts"
import { until } from "./test-waits.ts"

const turn: ScriptedElement[] = [running, said("hi"), idle]
const working: ScriptedElement[] = [running, said("working")]

const serverOptions = (
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  { deadline = "20 millis", ...options }: ScriptedOptions & { deadline?: Duration.Input },
) => ({
  db,
  turns,
  scripted: { reportSession: true, ...options },
  services: layerServicesWith(layerSessionRunsWith(deadline)),
})

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  options: ScriptedOptions & { deadline?: Duration.Input },
  use: (client: Client) => Effect.Effect<A, E>,
) => withTestServer(use, serverOptions(db, turns, options))

const withTestClock = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  options: ScriptedOptions & { deadline?: Duration.Input },
  use: (client: Client) => Effect.Effect<A, E, TestClock.TestClock>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(serverLayer(serverOptions(db, turns, options))),
      Effect.provide(TestClock.layer()),
      Effect.scoped,
    ),
  )

const newGate = () => ({
  reached: Effect.runSync(Deferred.make<void>()),
  release: Effect.runSync(Deferred.make<void>()),
})

const untilTypes = (db: DatabaseSync, sessionId: string, type: string) =>
  until(
    Effect.sync(() => typesOf(db, sessionId)),
    (types) => types.includes(type),
  )

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
