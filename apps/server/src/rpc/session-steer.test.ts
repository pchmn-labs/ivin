import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Rpcs } from "@ivin/contracts/rpcs"
import type { Session } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  layerScripted,
  scriptedRead,
  type ScriptedElement,
  type ScriptedOptions,
  type ScriptedSend,
} from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"

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
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted(turns, { reportSession: true, ...options })),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = yield* read
      if (done(value)) return value
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die("The condition was never met")
  })

const sessionOf = (client: Client, id: string) =>
  client["session.list"]({ projectPath: "/p" }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === id)!),
  )

const untilSession = (client: Client, id: string, done: (session: Session) => boolean) =>
  until(sessionOf(client, id), done)

const items = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 100 }).pipe(
    Effect.map((page) => page.items),
  )

const messages = (client: Client, sessionId: string) =>
  items(client, sessionId).pipe(
    Effect.map((all) =>
      all.flatMap((item) =>
        item.type === "message" && item.role === "user"
          ? [{ id: item.id, steer: item.steer }]
          : [],
      ),
    ),
  )

// Sends m1, which stops on an approval, then each of `steers` while the turn waits on it.
const startWithSteers = (client: Client, steers: readonly string[]) =>
  Effect.gen(function* () {
    const session = yield* client["session.create"]({ projectPath: "/p" })
    yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
    yield* untilSession(client, session.id, (s) => s.status === "waiting")
    for (const id of steers) {
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: id, text: id })
    }
    return session.id
  })

test("messages sent while the agent works wait as pending, then join the turn as steers once read", async () => {
  const sent: ScriptedSend[] = []
  const outcome = await withServer(
    newDatabase(),
    [[running, asked, scriptedRead, said("Noted"), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* startWithSteers(client, ["m2", "m3"])
        const pending = yield* sessionOf(client, id)
        const before = yield* messages(client, id)
        yield* client["session.answerApproval"]({ sessionId: id, requestId: "r1", allow: true })
        const after = yield* untilSession(client, id, (s) => s.status === "idle")
        return { pending, before, after, messages: yield* messages(client, id) }
      }),
    { sent },
  )

  expect(sent.map((s) => s.id)).toEqual(["m1", "m2", "m3"])
  expect(outcome.pending.status).toBe("waiting")
  expect(outcome.pending.pendingMessages.map((m) => m.id)).toEqual(["m2", "m3"])
  expect(outcome.before).toEqual([{ id: "m1", steer: false }])
  expect(outcome.after.pendingMessages).toEqual([])
  expect(outcome.messages).toEqual([
    { id: "m1", steer: false },
    { id: "m2", steer: true },
    { id: "m3", steer: true },
  ])
})

test("a steer stored in the transcript is a steer again after a restart", async () => {
  const db = newDatabase()
  const id = await withServer(db, [[running, asked, scriptedRead, idle]], (client) =>
    Effect.gen(function* () {
      const id = yield* startWithSteers(client, ["m2"])
      yield* client["session.answerApproval"]({ sessionId: id, requestId: "r1", allow: true })
      yield* untilSession(client, id, (s) => s.status === "idle")
      return id
    }),
  )

  const reloaded = await withServer(db, [], (client) => messages(client, id))

  expect(reloaded).toEqual([
    { id: "m1", steer: false },
    { id: "m2", steer: true },
  ])
})

test("a message the turn ends before reading starts the next turn, not a steer", async () => {
  const result = await withServer(
    newDatabase(),
    [
      [running, asked, idle],
      [running, said("Next"), idle],
    ],
    (client) =>
      Effect.gen(function* () {
        const id = yield* startWithSteers(client, ["m2"])
        yield* client["session.answerApproval"]({ sessionId: id, requestId: "r1", allow: true })
        yield* until(items(client, id), (all) => all.at(-1)?.type === "message")
        return yield* messages(client, id)
      }),
  )

  expect(result).toEqual([
    { id: "m1", steer: false },
    { id: "m2", steer: false },
  ])
})

test("stopping the turn puts its pending messages back as unread, and the agent never takes them", async () => {
  const sent: ScriptedSend[] = []
  const outcome = await withServer(
    newDatabase(),
    [[running, asked], [said("never")]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* startWithSteers(client, ["m2"])
        yield* client["session.interrupt"]({ sessionId: id })
        const session = yield* untilSession(client, id, (s) => s.status === "idle")
        const kinds = yield* until(items(client, id), (all) => all.at(-1)?.type === "interruption")
        return { session, kinds: kinds.map((i) => i.type) }
      }),
    { sent },
  )

  expect(outcome.session.pendingMessages).toEqual([])
  expect(outcome.session.unreadMessages).toEqual([{ id: "m2", text: "m2", images: [] }])
  expect(outcome.kinds).toEqual(["message", "approval", "interruption"])
})

test("the next message clears the unread messages", async () => {
  const unread = await withServer(
    newDatabase(),
    [[running, asked], [running, said("ok"), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* startWithSteers(client, ["m2"])
        yield* client["session.interrupt"]({ sessionId: id })
        yield* untilSession(client, id, (s) => s.unreadMessages.length === 1)
        const after = yield* client["session.sendMessage"]({
          sessionId: id,
          messageId: "m3",
          text: "m2",
        })
        return after.unreadMessages
      }),
  )

  expect(unread).toEqual([])
})

test("sending now stops the turn, and the pending messages start the next one", async () => {
  const interrupted: string[] = []
  const outcome = await withServer(
    newDatabase(),
    [
      [running, asked],
      [running, said("Next"), idle],
    ],
    (client) =>
      Effect.gen(function* () {
        const id = yield* startWithSteers(client, ["m2"])
        yield* client["session.sendNow"]({ sessionId: id })
        const all = yield* until(items(client, id), (all) => {
          const last = all.at(-1)
          return last?.type === "message" && last.role === "assistant"
        })
        const session = yield* untilSession(client, id, (s) => s.status === "idle")
        return { id, all, session }
      }),
    { interrupted },
  )

  expect(interrupted).toEqual([outcome.id])
  expect(outcome.session.pendingMessages).toEqual([])
  expect(outcome.session.unreadMessages).toEqual([])
  expect(
    outcome.all.map((i) => (i.type === "message" ? `${i.role}:${i.text}:${i.steer}` : i.type)),
  ).toEqual([
    "user:go:false",
    "approval",
    "interruption",
    "user:m2:false",
    "assistant:Next:false",
  ])
})

test("pending messages left by a previous server are unread after a restart", async () => {
  const db = newDatabase()
  const id = await withServer(db, [[running, asked]], (client) => startWithSteers(client, ["m2"]))

  const session = await withServer(db, [], (client) => sessionOf(client, id))

  expect(session.pendingMessages).toEqual([])
  expect(session.unreadMessages.map((m) => m.id)).toEqual(["m2"])
})
