import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  layerScripted,
  scriptedFailure,
  type StartInput,
  type ApprovalDecision,
  type ScriptedElement,
  type ScriptedOptions,
  type ScriptedSend,
} from "@ivin/harness"
import { Effect, Fiber, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { migrations, runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"

const turn: readonly HarnessOutput[] = [
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
  turns: readonly (readonly ScriptedElement[])[],
  sent: ScriptedSend[],
  use: (client: Client) => Effect.Effect<A, E>,
  options: ScriptedOptions = {},
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted(turns, { reportSession: true, ...options, sent })),
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
      const first = yield* client["session.create"]({ projectPath: "/p/one", model: "sonnet" })
      const second = yield* client["session.create"]({ projectPath: "/p/one", model: "sonnet" })
      yield* client["session.create"]({ projectPath: "/p/other", model: "sonnet" })
      yield* Effect.sleep("5 millis")
      yield* client["session.sendMessage"]({ sessionId: first.id, messageId: "m1", text: "hello" })
      return { first, second, listed: yield* client["session.list"]({ projectPath: "/p/one" }) }
    }),
  )

  expect(sessions.listed.map((s) => s.id)).toEqual([sessions.first.id, sessions.second.id])
})

test("a session keeps the model it was created with, in create and in the list", async () => {
  const { created, listed } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p", model: "opus" })
      return { created, listed: yield* client["session.list"]({ projectPath: "/p" }) }
    }),
  )

  expect(created.model).toBe("opus")
  expect(listed.map((s) => s.model)).toEqual(["opus"])
})

test("a session reports the harness of the server's provider", async () => {
  const { created, listed } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      return { created, listed: yield* client["session.list"]({ projectPath: "/p" }) }
    }),
  )

  expect(created.harness).toBe("scripted")
  expect(listed.map((s) => s.harness)).toEqual(["scripted"])
})

test("a session stored before sessions recorded their harness runs on claude", async () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(
    runMigrations(
      db,
      migrations.filter((m) => m.version <= 9),
    ),
  )
  db.prepare(
    `INSERT INTO sessions (id, project_path, working_folder, title, created_at, last_activity_at)
     VALUES ('s', '/p', '/p', 't', 0, 0)`,
  ).run()
  Effect.runSync(runMigrations(db))

  const listed = await withServer(db, [], [], (client) =>
    client["session.list"]({ projectPath: "/p" }),
  )

  expect(listed.map((s) => s.harness)).toEqual(["claude"])
})

test("a session is renamed, and an unknown session is not found", async () => {
  const { renamed, error } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
      const a = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const b = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
  expect(sent).toEqual([{ sessionId, text: "go", images: [] }])
})

test("a tool call and its result come back as one item, in order after the user message", async () => {
  const page = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
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

const delta = (kind: "assistant_text" | "thinking", text: string): HarnessOutput => ({
  type: "delta",
  kind,
  text,
})
const finished = (type: "assistant_text" | "thinking", text: string): HarnessOutput => ({
  type,
  text,
  raw: null,
})

const streamingTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  delta("thinking", "Hm"),
  delta("thinking", "m."),
  finished("thinking", "Hmm."),
  delta("assistant_text", "Look"),
  delta("assistant_text", "ing."),
  finished("assistant_text", "Looking."),
  { type: "tool_call", toolCallId: "t1", name: "ls", input: {}, raw: null },
  { type: "tool_result", toolCallId: "t1", output: "a.txt", isError: false, raw: null },
  delta("assistant_text", "Found "),
  delta("assistant_text", "a.txt."),
  finished("assistant_text", "Found a.txt."),
  delta("assistant_text", "Done."),
  finished("assistant_text", "Done."),
  { type: "status", status: "idle", raw: null },
]

test("deltas reach a watcher under the id of the stored item, and are never stored", async () => {
  const db = newDatabase()
  const { changes, reloaded } = await withServer(db, [streamingTurn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const watching = yield* client["transcript.watchItems"]({
        sessionId: session.id,
        before: 10,
      }).pipe(
        Stream.takeUntil(
          (change) =>
            change.type === "upsert" &&
            change.item.type === "message" &&
            change.item.text.endsWith("Done."),
        ),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      const changes = yield* Fiber.join(watching)
      return { changes, reloaded: yield* endOfTranscript(client, session.id) }
    }),
  )

  const deltas = changes.flatMap((change) => (change.type === "delta" ? [change] : []))
  expect(deltas.map((d) => d.text)).toEqual([
    "Hm",
    "m.",
    "Look",
    "ing.",
    "Found ",
    "a.txt.",
    "\n\nDone.",
  ])
  const items = reloaded.items
  expect(items.map((i) => [i.position, i.type === "message" ? i.text : i.type])).toEqual([
    [1, "go"],
    [3, "thinking"],
    [4, "Looking."],
    [5, "tool_call"],
    [7, "Found a.txt.\n\nDone."],
  ])
  for (const d of deltas) {
    const item = items.find((i) => i.id === d.itemId)
    expect(item).toMatchObject({ position: d.position, type: d.kind })
  }
  expect(new Set(deltas.map((d) => d.itemId)).size).toBe(3)

  const upserts = changes.flatMap((change) => (change.type === "upsert" ? [change.item] : []))
  expect(upserts.at(-1)).toEqual(items.at(-1))

  const rows = db.prepare("SELECT type, payload FROM transcript_events").all() as {
    type: string
    payload: string
  }[]
  expect(rows.map((r) => r.type)).not.toContain("delta")
  expect(
    rows.filter((r) => r.type === "assistant_text").map((r) => JSON.parse(r.payload).text),
  ).toEqual(["Looking.", "Found a.txt.", "Done."])
})

test("a status between a block's deltas and its finished event keeps the reserved id", async () => {
  const turnWithStatus: readonly HarnessOutput[] = [
    delta("assistant_text", "Hi"),
    { type: "status", status: "running", raw: null },
    finished("assistant_text", "Hi"),
  ]
  const { deltas, upsert } = await withServer(newDatabase(), [turnWithStatus], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const watching = yield* client["transcript.watchItems"]({
        sessionId: session.id,
        before: 10,
      }).pipe(
        Stream.takeUntil(
          (c) => c.type === "upsert" && c.item.type === "message" && c.item.text === "Hi",
        ),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      const changes = yield* Fiber.join(watching)
      return {
        deltas: changes.filter((c) => c.type === "delta"),
        upsert: changes.at(-1),
      }
    }),
  )

  expect(upsert).toMatchObject({ type: "upsert", item: { id: deltas[0]!.itemId } })
})

const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = yield* read
      if (done(value)) return value
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die("The condition was never met")
  })

const statusOf = (client: Client, projectPath: string, sessionId: string) =>
  client["session.list"]({ projectPath }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === sessionId)?.status),
  )

test("interrupting reaches the provider, stores an interruption, and the session is idle again", async () => {
  const interrupted: string[] = []
  const { id, page, status, before } = await withServer(
    newDatabase(),
    [[running, said("Working")]],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        const sent = yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "go",
        })
        yield* until(endOfTranscript(client, session.id), (p) => p.items.length === 2)
        const before = yield* statusOf(client, "/p", session.id)
        const returned = yield* client["session.interrupt"]({ sessionId: session.id })
        const status = yield* until(statusOf(client, "/p", session.id), (s) => s === "idle")
        const page = yield* until(endOfTranscript(client, session.id), (p) => p.items.length === 3)
        return { id: session.id, page, status, before: [sent.status, before, returned.id] }
      }),
    { interrupted },
  )

  expect(interrupted).toEqual([id])
  expect(before.slice(0, 2)).toEqual(["working", "working"])
  expect(page.items.map((item) => item.type)).toEqual(["message", "message", "interruption"])
  expect(status).toBe("idle")
})

test("interrupting a session with no run does nothing, and an unknown session is not found", async () => {
  const interrupted: string[] = []
  const { session, error } = await withServer(
    newDatabase(),
    [],
    [],
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        return {
          session: yield* client["session.interrupt"]({ sessionId: created.id }),
          error: yield* Effect.flip(client["session.interrupt"]({ sessionId: "nope" })),
        }
      }),
    { interrupted },
  )

  expect(session.status).toBe("idle")
  expect(error._tag).toBe("SessionNotFound")
  expect(interrupted).toEqual([])
})

test("a harness error is stored as an error item and fails the session, and the next message starts a new run", async () => {
  const sent: ScriptedSend[] = []
  const { page, status, afterRetry } = await withServer(
    newDatabase(),
    [
      [running, said("Starting"), scriptedFailure("You are not logged in to Claude.")],
      [said("Back"), idle],
    ],
    sent,
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        const status = yield* until(statusOf(client, "/p", session.id), (s) => s === "failed")
        const page = yield* endOfTranscript(client, session.id)
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m2",
          text: "again",
        })
        const afterRetry = yield* until(statusOf(client, "/p", session.id), (s) => s === "idle")
        return { page, status, afterRetry }
      }),
  )

  expect(status).toBe("failed")
  expect(page.items.map((item) => item.type)).toEqual(["message", "message", "error"])
  expect(page.items[2]).toMatchObject({ message: "You are not logged in to Claude." })
  expect(afterRetry).toBe("idle")
  expect(sent.map((s) => s.text)).toEqual(["go", "again"])
})

test("a harness that cannot start stores the message and an error, and fails the session", async () => {
  const { returned, page } = await withServer(
    newDatabase(),
    [],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        const returned = yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "go",
        })
        return { returned, page: yield* endOfTranscript(client, session.id) }
      }),
    { startFailure: "Claude Code is not installed." },
  )

  expect(returned.status).toBe("failed")
  expect(page.items).toMatchObject([
    { id: "m1", role: "user", text: "go" },
    { type: "error", message: "Claude Code is not installed." },
  ])
})

test("a harness that cannot take a message stores the message and an error, and fails the session", async () => {
  const { returned, page } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const returned = yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
      })
      return { returned, page: yield* endOfTranscript(client, session.id) }
    }),
  )

  expect(returned.status).toBe("failed")
  expect(page.items).toMatchObject([
    { id: "m1", role: "user", text: "go" },
    { type: "error", message: "The scripted harness has no turn left" },
  ])
})

test("a message sent while a turn is still running reaches the provider", async () => {
  const sent: ScriptedSend[] = []
  const status = await withServer(
    newDatabase(),
    [
      [running, said("Working")],
      [said("Noted"), idle],
    ],
    sent,
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        yield* until(endOfTranscript(client, session.id), (p) => p.items.length === 2)
        expect(yield* statusOf(client, "/p", session.id)).toBe("working")
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m2",
          text: "also",
        })
        return yield* until(statusOf(client, "/p", session.id), (s) => s === "idle")
      }),
  )

  expect(sent.map((s) => s.text)).toEqual(["go", "also"])
  expect(status).toBe("idle")
})

test("watching a project's sessions streams each status and title change", async () => {
  const changes = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.create"]({ projectPath: "/other", model: "sonnet" })
      const watching = yield* client["session.watch"]({ projectPath: "/p" }).pipe(
        Stream.filter((change) => change._tag === "changed"),
        Stream.map((change) => change.session),
        Stream.takeUntil((s) => s.status === "idle" && s.title === "go"),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      return yield* Fiber.join(watching)
    }),
  )

  expect(changes[0]).toMatchObject({ status: "idle", title: "New session" })
  expect(changes[1]).toMatchObject({ status: "working", title: "go" })
  expect(changes.at(-1)).toMatchObject({ status: "idle", projectPath: "/p" })
  expect(new Set(changes.map((s) => s.projectPath))).toEqual(new Set(["/p"]))
})

test("a session's status keeps the time it changed until it changes again", async () => {
  const changes = await withServer(newDatabase(), [turn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const watching = yield* client["session.watch"]({ projectPath: "/p" }).pipe(
        Stream.filter((change) => change._tag === "changed"),
        Stream.map((change) => change.session),
        Stream.takeUntil((s) => s.status === "idle" && s.title === "go"),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      return yield* Fiber.join(watching)
    }),
  )
  const changedAt = (status: string) =>
    new Set(
      changes
        .filter((s) => s.status === status && s.title === "go")
        .map((s) => s.statusChangedAt.epochMilliseconds),
    )

  expect(changes[0]!.statusChangedAt).toEqual(changes[0]!.createdAt)
  expect(changes.filter((s) => s.status === "working").length).toBeGreaterThan(1)
  expect(changedAt("working").size).toBe(1)
  expect([...changedAt("idle")][0]).toBeGreaterThanOrEqual([...changedAt("working")][0]!)
})

test("a session left working by a previous server is idle again after a restart", async () => {
  const db = newDatabase()
  const id = await withServer(db, [[running, said("Working")]], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      return session.id
    }),
  )
  expect(db.prepare("SELECT status FROM sessions WHERE id = ?").get(id)).toEqual({
    status: "working",
  })

  const status = await withServer(db, [], [], (client) => statusOf(client, "/p", id))

  expect(status).toBe("idle")
})

test("closing the server closes the agent of every run", async () => {
  const closed: string[] = []
  const id = await withServer(
    newDatabase(),
    [[running, said("Working")]],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        expect(closed).toEqual([])
        return session.id
      }),
    { closed },
  )

  expect(closed).toEqual([id])
})

test("a run started by one client is seen, interrupted and continued by another, and keeps its status", async () => {
  const sent: ScriptedSend[] = []
  const interrupted: string[] = []
  const db = newDatabase()
  const outcome = await Effect.runPromise(
    Effect.gen(function* () {
      const services = yield* Layer.build(
        layerServices.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              Layer.succeed(Database)(db),
              Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
              layerKeybindingsFileOf([]),
              layerSettingsFileOf([]),
              layerScripted([[running, said("Working")], [said("Noted")]], { sent, interrupted }),
            ),
          ),
        ),
      )
      const connection = handlers.pipe(
        Layer.provide(Layer.succeedContext(services)),
        Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
      )
      const as = <A, E>(use: (client: Client) => Effect.Effect<A, E>) =>
        makeClient().pipe(Effect.flatMap(use), Effect.provide(connection))

      const id = yield* as((a) =>
        Effect.gen(function* () {
          const session = yield* a["session.create"]({ projectPath: "/p", model: "sonnet" })
          yield* a["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
          yield* until(endOfTranscript(a, session.id), (p) => p.items.length === 2)
          return session.id
        }),
      )
      return yield* as((b) =>
        Effect.gen(function* () {
          const status = yield* statusOf(b, "/p", id)
          yield* b["session.interrupt"]({ sessionId: id })
          yield* until(endOfTranscript(b, id), (p) => p.items.length === 3)
          yield* b["session.sendMessage"]({ sessionId: id, messageId: "m2", text: "more" })
          const page = yield* until(endOfTranscript(b, id), (p) => p.items.length === 5)
          return { id, status, page }
        }),
      )
    }).pipe(Effect.scoped),
  )

  expect(outcome.status).toBe("working")
  expect(interrupted).toEqual([outcome.id])
  expect(sent.map((s) => s.text)).toEqual(["go", "more"])
  expect(outcome.page.items.map((i) => i.type)).toEqual([
    "message",
    "message",
    "interruption",
    "message",
    "message",
  ])
})

test("watching a project's sessions starts with every current session of the project", async () => {
  const { current, listed } = await withServer(newDatabase(), [], [], (client) =>
    Effect.gen(function* () {
      yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.create"]({ projectPath: "/p", model: "opus" })
      yield* client["session.create"]({ projectPath: "/other", model: "sonnet" })
      return {
        current: yield* client["session.watch"]({ projectPath: "/p" }).pipe(
          Stream.filter((change) => change._tag === "changed"),
          Stream.map((change) => change.session),
          Stream.take(2),
          Stream.runCollect,
        ),
        listed: yield* client["session.list"]({ projectPath: "/p" }),
      }
    }),
  )

  expect(new Set(current.map((s) => s.id))).toEqual(new Set(listed.map((s) => s.id)))
})

test("closing the server closes every run at once, not one after the other", async () => {
  const closed: string[] = []
  const started = await withServer(
    newDatabase(),
    [[running], [running], [running], [running]],
    [],
    (client) =>
      Effect.gen(function* () {
        for (const n of [1, 2, 3, 4]) {
          const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
          yield* client["session.sendMessage"]({
            sessionId: session.id,
            messageId: `m${n}`,
            text: "go",
          })
        }
        return Date.now()
      }),
    { closed, closeDelay: "150 millis" },
  )

  expect(closed).toHaveLength(4)
  expect(Date.now() - started).toBeLessThan(450)
})

test("a session resumes with the provider session id stored by an earlier server, and its events append", async () => {
  const db = newDatabase()
  const starts: StartInput[] = []
  const sessionId = await withServer(
    db,
    [turn],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        yield* untilItems(client, session.id, 4)
        return session.id
      }),
    { starts },
  )
  expect(starts.map((s) => s.providerSessionId)).toEqual([null])

  const page = await withServer(
    db,
    [turn],
    [],
    (client) =>
      Effect.gen(function* () {
        yield* client["session.sendMessage"]({ sessionId, messageId: "m2", text: "again" })
        for (let attempt = 0; attempt < 200; attempt++) {
          const page = yield* endOfTranscript(client, sessionId)
          const last = page.items.at(-1)
          if (page.items.length >= 8 && last?.type === "message" && last.text.endsWith("a.txt."))
            return page
          yield* Effect.sleep("5 millis")
        }
        return yield* Effect.die("The second turn never reached the transcript")
      }),
    { starts },
  )

  expect(starts.map((s) => s.providerSessionId)).toEqual([null, `scripted-${sessionId}`])
  expect(page.items.map((i) => i.position)).toEqual([1, 3, 4, 6, 8, 10, 11, 13])
  expect(page.items[0]).toMatchObject({ id: "m1", text: "go" })
  expect(page.items[4]).toMatchObject({ id: "m2", text: "again" })
})

const approvalTurn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "Looking.", raw: null },
  {
    type: "approval_request",
    requestId: "r1",
    toolCallId: "t1",
    name: "ls",
    input: { path: "." },
    raw: null,
  },
  { type: "tool_call", toolCallId: "t1", name: "ls", input: { path: "." }, raw: null },
  { type: "tool_result", toolCallId: "t1", output: "a.txt", isError: false, raw: null },
  { type: "assistant_text", text: "Found a.txt.", raw: null },
  { type: "status", status: "idle", raw: null },
]

const untilStatus = (client: Client, sessionId: string, status: string) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      if ((yield* statusOf(client, "/p", sessionId)) === status) return
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die(`The session never reached ${status}`)
  })

const askAndAnswer = async (allow: boolean) => {
  const db = newDatabase()
  const responded: ApprovalDecision[] = []
  const page = await withServer(
    db,
    [approvalTurn],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        yield* untilStatus(client, session.id, "waiting")
        yield* client["session.answerApproval"]({
          sessionId: session.id,
          requestId: "r1",
          allow,
        })
        return yield* untilItems(client, session.id, 5)
      }),
    { responded },
  )
  const decisions = db
    .prepare("SELECT payload FROM transcript_events WHERE type = 'approval_decision'")
    .all() as { payload: string }[]
  return { page, responded, decisions: decisions.map((d) => JSON.parse(d.payload)) }
}

test("allowing a request stores the decision, tells the harness and lets the turn finish", async () => {
  const { page, responded, decisions } = await askAndAnswer(true)

  expect(decisions).toMatchObject([{ requestId: "r1", allow: true, raw: null }])
  expect(page.items.find((item) => item.type === "approval")).toMatchObject({
    requestId: "r1",
    decision: "allow",
  })
  expect(responded).toEqual([{ requestId: "r1", allow: true }])
  expect(page.items.at(-1)).toMatchObject({ text: "Found a.txt." })
})

test("denying a request stores the decision and tells the harness", async () => {
  const { page, responded, decisions } = await askAndAnswer(false)

  expect(decisions).toMatchObject([{ requestId: "r1", allow: false }])
  expect(page.items.find((item) => item.type === "approval")).toMatchObject({ decision: "deny" })
  expect(responded).toEqual([{ requestId: "r1", allow: false }])
})

test("a session waits for approval while a request is open, then goes back to working and idle", async () => {
  const statuses = await withServer(newDatabase(), [approvalTurn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      yield* untilStatus(client, session.id, "waiting")
      const waiting = yield* statusOf(client, "/p", session.id)
      yield* client["session.answerApproval"]({
        sessionId: session.id,
        requestId: "r1",
        allow: true,
      })
      yield* untilStatus(client, session.id, "idle")
      return [waiting, yield* statusOf(client, "/p", session.id)]
    }),
  )

  expect(statuses).toEqual(["waiting", "idle"])
})

test("answering a request that is not open fails, and so does an unknown session", async () => {
  const errors = await withServer(newDatabase(), [approvalTurn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      const idle = yield* Effect.flip(
        client["session.answerApproval"]({ sessionId: session.id, requestId: "r1", allow: true }),
      )
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      yield* untilStatus(client, session.id, "waiting")
      const unknown = yield* Effect.flip(
        client["session.answerApproval"]({ sessionId: session.id, requestId: "zz", allow: true }),
      )
      const missing = yield* Effect.flip(
        client["session.answerApproval"]({ sessionId: "nope", requestId: "r1", allow: true }),
      )
      return [idle._tag, unknown._tag, missing._tag]
    }),
  )

  expect(errors).toEqual(["ApprovalNotOpen", "ApprovalNotOpen", "SessionNotFound"])
})

test("two concurrent answers to one request give one decision and one ApprovalNotOpen", async () => {
  const db = newDatabase()
  const responded: ApprovalDecision[] = []
  const results = await withServer(
    db,
    [approvalTurn],
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
        yield* untilStatus(client, session.id, "waiting")
        const answer = client["session.answerApproval"]({
          sessionId: session.id,
          requestId: "r1",
          allow: true,
        })
        const exits = yield* Effect.all([Effect.exit(answer), Effect.exit(answer)], {
          concurrency: "unbounded",
        })
        yield* untilStatus(client, session.id, "idle")
        return exits.map((exit) => exit._tag)
      }),
    { responded },
  )

  expect(results.toSorted()).toEqual(["Failure", "Success"])
  expect(responded).toEqual([{ requestId: "r1", allow: true }])
  const decisions = db.prepare("SELECT 1 FROM transcript_events WHERE type = 'approval_decision'")
  expect(decisions.all()).toHaveLength(1)
})

test("a turn that ends right after the answer leaves the session idle, not working", async () => {
  const status = await withServer(newDatabase(), [approvalTurn], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      yield* untilStatus(client, session.id, "waiting")
      yield* client["session.answerApproval"]({
        sessionId: session.id,
        requestId: "r1",
        allow: true,
      })
      yield* untilItems(client, session.id, 5)
      yield* Effect.sleep("30 millis")
      return yield* statusOf(client, "/p", session.id)
    }),
  )

  expect(status).toBe("idle")
})

test("answering an approval puts a session that waited back to working until the turn ends", async () => {
  const turnThatKeepsRunning: readonly HarnessOutput[] = [
    { type: "status", status: "running", raw: null },
    { ...approvalTurn[2]! },
    { type: "assistant_text", text: "Carrying on.", raw: null },
  ]
  const statuses = await withServer(newDatabase(), [turnThatKeepsRunning], [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
      yield* untilStatus(client, session.id, "waiting")
      const answered = yield* client["session.answerApproval"]({
        sessionId: session.id,
        requestId: "r1",
        allow: true,
      })
      yield* until(endOfTranscript(client, session.id), (p) => p.items.length === 3)
      return [answered.status, yield* statusOf(client, "/p", session.id)]
    }),
  )

  expect(statuses).toEqual(["working", "working"])
})
