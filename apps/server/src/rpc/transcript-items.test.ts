import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput, TranscriptItem } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedElement } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { migrations, runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return db
}

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  use: (client: Client) => Effect.Effect<A, E>,
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
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted(turns)),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (;;) {
      const value = yield* read
      if (done(value)) return value
      yield* Effect.sleep("5 millis")
    }
  })

const statusOf = (client: Client, sessionId: string) =>
  client["session.list"]({ projectPath: "/p" }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === sessionId)),
  )

const untilStatus = (client: Client, sessionId: string, status: string) =>
  until(statusOf(client, sessionId), (session) => session?.status === status)

const everything = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 10_000, after: 0 })

const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })
const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const call = (id: string): HarnessOutput => ({
  type: "tool_call",
  toolCallId: id,
  name: "Bash",
  input: { command: id },
  raw: null,
})
const result = (id: string): HarnessOutput => ({
  type: "tool_result",
  toolCallId: id,
  output: `${id} done`,
  isError: false,
  raw: null,
})
const approval = (requestId: string): HarnessOutput => ({
  type: "approval_request",
  requestId,
  toolCallId: null,
  name: "Bash",
  input: { command: "rm" },
  raw: null,
})
const question: HarnessOutput = {
  type: "question_request",
  requestId: "q1",
  toolCallId: null,
  questions: [
    {
      question: "Which?",
      header: "Pick",
      options: [{ label: "A", description: "" }],
      multiSelect: false,
    },
  ],
  raw: null,
}

const many = Array.from({ length: 30 }, (_, i) => `c${i}`)
const turns: readonly (readonly ScriptedElement[])[] = [
  [
    running,
    said("one"),
    said("two"),
    call("late"),
    ...many.flatMap((id) => [call(id), result(id)]),
    { type: "thinking", text: "hmm", raw: null },
    result("late"),
    said("three"),
    {
      type: "usage",
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: null,
      raw: null,
    },
    said("four"),
    idle,
  ],
  [running, approval("r1"), call("after-approval"), result("after-approval"), said("ok"), idle],
  [running, question, said("thanks"), idle],
  [running, said("working"), approval("r2")],
  [running, call("next-run"), result("next-run"), said("again"), idle],
]

// Every page shape the UI asks for: the end, and around each item with small and large windows.
const pagesOf = (client: Client, sessionId: string, positions: readonly number[]) =>
  Effect.forEach(
    [null, ...positions, Math.max(...positions) + 1].flatMap((position) =>
      [
        { before: 3, after: 3 },
        { before: 50, after: 0 },
        { before: 0, after: 50 },
      ].map((window) => ({ position, ...window })),
    ),
    (window) => client["transcript.getItems"]({ sessionId, ...window }),
  )

const scriptedSession = (db: DatabaseSync) =>
  withServer(db, turns, (client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m1", text: "go" })
      yield* untilStatus(client, id, "idle")
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m2", text: "next" })
      yield* untilStatus(client, id, "waiting")
      yield* client["session.answerApproval"]({ sessionId: id, requestId: "r1", allow: true })
      yield* untilStatus(client, id, "idle")
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m3", text: "ask" })
      yield* untilStatus(client, id, "waiting")
      yield* client["session.answerQuestion"]({
        sessionId: id,
        requestId: "q1",
        answers: [{ question: "Which?", choices: ["A"] }],
      })
      yield* untilStatus(client, id, "idle")
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m4", text: "more" })
      yield* untilStatus(client, id, "waiting")
      yield* client["session.interrupt"]({ sessionId: id })
      yield* untilStatus(client, id, "idle")
      // New options start a second run, which carries on from the items the first one stored.
      yield* client["session.setRunOptions"]({
        sessionId: id,
        options: { model: "scripted-large" },
      })
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m5", text: "again" })
      yield* until(everything(client, id), (page) =>
        page.items.some(
          (item) => item.type === "message" && item.text === "again" && item.role === "assistant",
        ),
      )
      return id
    }),
  )

test("every page read from stored items equals the page derived from all of the session's events", async () => {
  const db = newDatabase()
  const sessionId = await scriptedSession(db)

  const { stored, derived, items } = await withServer(db, turns, (client) =>
    Effect.gen(function* () {
      const items = (yield* everything(client, sessionId)).items
      const positions = items.map((item) => item.position)
      const stored = yield* pagesOf(client, sessionId, positions)
      db.prepare("DELETE FROM transcript_item_states WHERE session_id = ?").run(sessionId)
      const derived = yield* pagesOf(client, sessionId, positions)
      return { stored, derived, items }
    }),
  )

  expect(stored).toEqual(derived)
  const byType = (type: TranscriptItem["type"]) => items.filter((item) => item.type === type)
  expect(byType("message").map((item) => item.type === "message" && item.text)).toContain(
    "three\n\nfour",
  )
  expect(
    items.find((item) => item.type === "tool_call" && item.toolCallId === "late"),
  ).toMatchObject({ status: "done", output: "late done" })
  expect(byType("approval")).toMatchObject([{ decision: "allow" }, { decision: "unanswered" }])
  expect(byType("question")).toMatchObject([{ status: "answered" }])
  expect(byType("interruption")).toHaveLength(1)
})

test("a page of a session whose items are current is read without its events", async () => {
  const db = newDatabase()
  const { before, after } = await withServer(db, turns, (client) =>
    Effect.gen(function* () {
      const { id: sessionId } = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId, messageId: "m1", text: "go" })
      const before = yield* until(everything(client, sessionId), (page) =>
        page.items.some((item) => item.type === "message" && item.text === "three\n\nfour"),
      )
      db.prepare("DELETE FROM transcript_events WHERE session_id = ?").run(sessionId)
      return { before, after: yield* everything(client, sessionId) }
    }),
  )

  expect(before.items.length).toBeGreaterThan(30)
  expect(after).toEqual(before)
})

test("a session stored before items existed gets them on its first read, and only once", async () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db, migrations.slice(0, 21)))
  trustEveryFolder(db)
  db.exec(
    `INSERT INTO sessions (id, project_path, working_folder, title, created_at, last_activity_at)
     VALUES ('old', '/p', '/p', 't', 0, 0);
     INSERT INTO transcript_events (id, session_id, sequence, type, at, payload) VALUES
       ('e1', 'old', 1, 'user_message', 1, '{"type":"user_message","text":"hi","raw":null}'),
       ('e2', 'old', 2, 'assistant_text', 2, '{"type":"assistant_text","text":"a","raw":{"x":1}}'),
       ('e3', 'old', 3, 'assistant_text', 3, '{"type":"assistant_text","text":"b","raw":null}')`,
  )
  Effect.runSync(runMigrations(db))

  const { first, second } = await withServer(db, [], (client) =>
    Effect.gen(function* () {
      const first = yield* everything(client, "old")
      db.prepare(
        "UPDATE transcript_items SET payload = json_set(payload, '$.text', 'kept') WHERE id = 'e2'",
      ).run()
      return { first, second: yield* everything(client, "old") }
    }),
  )

  expect(first.items).toMatchObject([
    { id: "e1", text: "hi" },
    { id: "e2", text: "a\n\nb" },
  ])
  expect(second.items[1]).toMatchObject({ id: "e2", text: "kept" })
})

const approvalTurn: readonly ScriptedElement[] = [running, approval("r1"), said("done"), idle]

test("stopping a session that waits for an approval leaves the approval unanswered and the session idle", async () => {
  const { item, session, answer } = await withServer(newDatabase(), [approvalTurn], (client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId: id, messageId: "m1", text: "go" })
      yield* untilStatus(client, id, "waiting")
      yield* client["session.interrupt"]({ sessionId: id })
      const page = yield* until(everything(client, id), (page) =>
        page.items.some((item) => item.type === "approval" && item.decision !== null),
      )
      const answer = yield* client["session.answerApproval"]({
        sessionId: id,
        requestId: "r1",
        allow: true,
      }).pipe(Effect.flip)
      return {
        item: page.items.find((item) => item.type === "approval"),
        session: yield* untilStatus(client, id, "idle"),
        answer: answer._tag,
      }
    }),
  )

  expect(item).toMatchObject({ requestId: "r1", decision: "unanswered" })
  expect(session).toMatchObject({ status: "idle", waitingFor: null })
  expect(answer).toBe("ApprovalNotOpen")
})

test("a server started on a session left waiting for an approval leaves it unanswered and the session idle", async () => {
  const db = newDatabase()
  const sessionId = await withServer(db, [], (client) =>
    client["session.create"]({ projectPath: "/p" }).pipe(Effect.map((session) => session.id)),
  )
  // As a server that stopped without closing its runs leaves it.
  db.prepare(
    `INSERT INTO transcript_events (id, session_id, sequence, type, at, payload) VALUES
       ('e1', ?, 1, 'user_message', 1, '{"type":"user_message","text":"go"}'),
       ('e2', ?, 2, 'approval_request', 2, ?)`,
  ).run(sessionId, sessionId, JSON.stringify({ ...approval("r1"), raw: undefined }))
  db.prepare("UPDATE sessions SET status = 'waiting', waiting_for = 'approval' WHERE id = ?").run(
    sessionId,
  )

  const { item, session } = await withServer(db, [], (client) =>
    Effect.gen(function* () {
      const page = yield* everything(client, sessionId)
      return {
        item: page.items.find((item) => item.type === "approval"),
        session: yield* statusOf(client, sessionId),
      }
    }),
  )

  expect(item).toMatchObject({ requestId: "r1", decision: "unanswered" })
  expect(session).toMatchObject({ status: "idle", waitingFor: null })
})
