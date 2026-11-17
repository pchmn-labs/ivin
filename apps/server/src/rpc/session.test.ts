import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessEvent } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedSend } from "@ivin/harness"
import { Effect, Fiber, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers } from "./handlers.ts"

const turn: readonly HarnessEvent[] = [
  { type: "status", status: "running", raw: { from: "scripted" } },
  { type: "assistant_text", text: "Looking.", raw: null },
  { type: "tool_call", toolCallId: "t1", name: "ls", input: { path: "." }, raw: null },
  { type: "tool_result", toolCallId: "t1", output: "a.txt", isError: false, raw: null },
  { type: "assistant_text", text: "Found a.txt.", raw: null },
  { type: "status", status: "idle", raw: null },
]

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return db
}

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly HarnessEvent[])[],
  sent: ScriptedSend[],
  use: (client: Client) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerScripted(turns, { sent })),
        ),
      ),
      Effect.scoped,
    ),
  )

const endOfTranscript = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 100 })

const untilItems = (client: Client, sessionId: string, count: number) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      const page = yield* endOfTranscript(client, sessionId)
      const done = page.items.at(-1)
      if (page.items.length >= count && done?.type === "message" && done.text.endsWith("a.txt."))
        return page
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die("The scripted turn never reached the transcript")
  })

test("a created session is listed for its project, newest activity first", async () => {
  const sessions = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const first = yield* client["session.create"]({ projectPath: "/p/one" })
      const second = yield* client["session.create"]({ projectPath: "/p/one" })
      yield* client["session.create"]({ projectPath: "/p/other" })
      yield* Effect.sleep("5 millis")
      yield* client["session.sendMessage"]({ sessionId: first.id, messageId: "m1", text: "hello" })
      return { first, second, listed: yield* client["session.list"]({ projectPath: "/p/one" }) }
    }),
  )

  expect(sessions.listed.map((s) => s.id)).toEqual([sessions.first.id, sessions.second.id])
})

test("a session is renamed, and an unknown session is not found", async () => {
  const { renamed, error } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const renamed = yield* client["session.rename"]({ sessionId: session.id, title: " Mine " })
      const error = yield* Effect.flip(client["session.rename"]({ sessionId: "nope", title: "x" }))
      return { renamed, error }
    }),
  )

  expect(renamed.title).toBe("Mine")
  expect(error._tag).toBe("SessionNotFound")
})

test("the first message sets the title, and a rename is never overwritten by it", async () => {
  const titles = await withServer(newDatabase(), [turn, turn], [], (client) =>
    Effect.gen(function* () {
      const a = yield* client["session.create"]({ projectPath: "/p" })
      const b = yield* client["session.create"]({ projectPath: "/p" })
      const afterFirst = yield* client["session.sendMessage"]({
        sessionId: a.id,
        messageId: "m1",
        text: "  Fix the login bug\nplease  ",
      })
      yield* client["session.rename"]({ sessionId: b.id, title: "My name" })
      const afterRenamed = yield* client["session.sendMessage"]({
        sessionId: b.id,
        messageId: "m2",
        text: "something else",
      })
      return [afterFirst.title, afterRenamed.title]
    }),
  )

  expect(titles).toEqual(["Fix the login bug", "My name"])
})

test("sending a message stores the user message then the scripted events in order", async () => {
  const db = newDatabase()
  const sent: ScriptedSend[] = []
  const sessionId = await withServer(db, [turn], sent, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "msg-1",
        text: "go",
      })
      yield* untilItems(client, session.id, 4)
      return session.id
    }),
  )

  const rows = db
    .prepare(
      "SELECT id, sequence, type, payload FROM transcript_events WHERE session_id = ? ORDER BY sequence",
    )
    .all(sessionId) as { id: string; sequence: number; type: string; payload: string }[]
  expect(rows.map((r) => [r.sequence, r.type])).toEqual([
    [1, "user_message"],
    [2, "status"],
    [3, "assistant_text"],
    [4, "tool_call"],
    [5, "tool_result"],
    [6, "assistant_text"],
    [7, "status"],
  ])
  expect(rows[0]!.id).toBe("msg-1")
  expect(JSON.parse(rows[1]!.payload).raw).toEqual({ from: "scripted" })
  expect(sent).toEqual([{ sessionId, text: "go" }])
})

test("a tool call and its result come back as one item, in order after the user message", async () => {
  const page = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "msg-1",
        text: "go",
      })
      return yield* untilItems(client, session.id, 4)
    }),
  )

  expect(page.items.map((item) => item.type)).toEqual([
    "message",
    "message",
    "tool_call",
    "message",
  ])
  expect(page.items[0]).toMatchObject({ id: "msg-1", role: "user", text: "go" })
  expect(page.items[2]).toMatchObject({
    type: "tool_call",
    toolCallId: "t1",
    status: "done",
    output: "a.txt",
  })
  expect(page).toMatchObject({ hasBefore: false, hasAfter: false })
})

test("items are paged around a position", async () => {
  const page = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "msg-1",
        text: "go",
      })
      yield* untilItems(client, session.id, 4)
      return yield* client["transcript.getItems"]({
        sessionId: session.id,
        position: 4,
        before: 1,
        after: 1,
      })
    }),
  )

  expect(page.items.map((item) => item.type)).toEqual(["message", "tool_call"])
  expect(page).toMatchObject({ hasBefore: true, hasAfter: true })
})

test("watching a session starts with the last items as a page, then streams upserts", async () => {
  const changes = await withServer(newDatabase(), [turn, turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      yield* untilItems(client, session.id, 4)
      const watching = yield* client["transcript.watchItems"]({
        sessionId: session.id,
        before: 2,
      }).pipe(Stream.take(6), Stream.runCollect, Effect.forkChild)
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m2",
        text: "again",
      })
      return yield* Fiber.join(watching)
    }),
  )

  const [first, ...upserts] = changes
  expect(first?.type === "page" && first.page.items.map((i) => i.type)).toEqual([
    "tool_call",
    "message",
  ])
  expect(first).toMatchObject({ page: { hasBefore: true, hasAfter: false } })
  expect(upserts.map((c) => c.type)).toEqual(["upsert", "upsert", "upsert", "upsert", "upsert"])
  expect(upserts[0]).toMatchObject({ item: { id: "m2", role: "user", text: "again" } })
})

test("an item reaches a watcher only after its events are in the database", async () => {
  const db = newDatabase()
  const checks = await withServer(db, [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const stored = (sql: string, ...args: string[]) => db.prepare(sql).get(...args) !== undefined
      const watching = yield* client["transcript.watchItems"]({
        sessionId: session.id,
        before: 10,
      }).pipe(
        Stream.drop(1),
        Stream.take(5),
        Stream.map((change) => {
          if (change.type !== "upsert") return false
          const { item } = change
          const row = stored("SELECT 1 FROM transcript_events WHERE id = ?", item.id)
          return item.type === "tool_call" && item.status === "done"
            ? row &&
                stored(
                  "SELECT 1 FROM transcript_events WHERE session_id = ? AND type = 'tool_result'",
                  session.id,
                )
            : row
        }),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      return yield* Fiber.join(watching)
    }),
  )

  expect(checks).toEqual([true, true, true, true, true])
})

test("when the harness fails after the user message was stored, the message stays whole", async () => {
  const db = newDatabase()
  const outcome = await withServer(db, [], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const exit = yield* Effect.exit(
        client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" }),
      )
      return { exit, page: yield* endOfTranscript(client, session.id) }
    }),
  )

  expect(outcome.exit._tag).toBe("Failure")
  expect(outcome.page.items).toMatchObject([{ id: "m1", role: "user", text: "go" }])
})
