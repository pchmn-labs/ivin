import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  layerScripted,
  scriptedFailure,
  type ScriptedElement,
  type ScriptedOptions,
  type StartInput,
} from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"

const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })
const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const answered = (text: string): readonly HarnessOutput[] => [running, said(text), idle]

const defaults = { model: "scripted", effort: "low", permissionMode: "ask" }

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

const sessionOf = (client: Client, sessionId: string) =>
  client["session.list"]({ projectPath: "/p" }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === sessionId)),
  )

const itemsOf = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 100 }).pipe(
    Effect.map((page) => page.items),
  )

const untilSaid = (client: Client, sessionId: string, text: string) =>
  until(itemsOf(client, sessionId), (items) =>
    items.some((item) => item.type === "message" && item.text === text),
  )

const untilIdle = (client: Client, sessionId: string) =>
  until(sessionOf(client, sessionId), (session) => session?.status === "idle")

test("a new session takes the harness's defaults, then the project's last run options", async () => {
  const sessions = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const first = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: first.id,
        options: { model: "scripted-large", permissionMode: "auto" },
      })
      return {
        first,
        sameProject: yield* client["session.create"]({ projectPath: "/p" }),
        otherProject: yield* client["session.create"]({ projectPath: "/other" }),
      }
    }),
  )

  expect(sessions.first).toMatchObject(defaults)
  expect(sessions.sameProject).toMatchObject({
    model: "scripted-large",
    effort: "low",
    permissionMode: "auto",
  })
  expect(sessions.otherProject).toMatchObject(defaults)
})

test("a new session does not take a last value its harness no longer offers", async () => {
  const created = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const first = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: first.id,
        options: { model: "retired", effort: "high" },
      })
      return yield* client["session.create"]({ projectPath: "/p" })
    }),
  )

  expect(created).toMatchObject({ model: "scripted", effort: "high" })
})

test("a change while idle starts the next run with the new options and the stored provider session id", async () => {
  const starts: StartInput[] = []
  const closed: string[] = []
  const sessionId = await withServer(
    newDatabase(),
    [answered("one"), answered("two")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilIdle(client, session.id)
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted-large", effort: "high" },
        })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m2", text: "b" })
        yield* untilSaid(client, session.id, "two")
        return session.id
      }),
    { starts, closed },
  )

  expect(starts.map((start) => start.options)).toEqual([
    defaults,
    { model: "scripted-large", effort: "high", permissionMode: "ask" },
  ])
  expect(starts[1]?.providerSessionId).toBe(`scripted-${sessionId}`)
  expect(closed[0]).toBe(sessionId)
})

test("a change while running leaves the running turn alone and applies to the next", async () => {
  const starts: StartInput[] = []
  await withServer(
    newDatabase(),
    [[running, said("working")], [said("steered"), idle], answered("next")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilSaid(client, session.id, "working")
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted-large" },
        })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m2", text: "b" })
        yield* untilSaid(client, session.id, "steered")
        expect(starts).toHaveLength(1)
        yield* untilIdle(client, session.id)
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m3", text: "c" })
        yield* untilSaid(client, session.id, "next")
      }),
    { starts },
  )

  expect(starts.map((start) => start.options.model)).toEqual(["scripted", "scripted-large"])
})

test("each change appends a transcript line naming the old and the new value", async () => {
  const items = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: session.id,
        options: { model: "scripted", effort: "high", permissionMode: "auto" },
      })
      return yield* itemsOf(client, session.id)
    }),
  )

  expect(items).toMatchObject([
    {
      type: "run_option",
      option: "effort",
      from: "low",
      to: "high",
      fromName: "Low",
      toName: "High",
    },
    {
      type: "run_option",
      option: "permissionMode",
      from: "ask",
      to: "auto",
      fromName: "Ask",
      toName: "Auto",
    },
  ])
})

test("run options survive a server restart and start the next run", async () => {
  const db = newDatabase()
  const starts: StartInput[] = []
  const sessionId = await withServer(db, [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: session.id,
        options: { effort: "high", permissionMode: "auto" },
      })
      return session.id
    }),
  )

  const listed = await withServer(
    db,
    [answered("one")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* sessionOf(client, sessionId)
        yield* client["session.sendMessage"]({ sessionId, messageId: "m1", text: "a" })
        yield* untilSaid(client, sessionId, "one")
        return session
      }),
    { starts },
  )

  expect(listed).toMatchObject({ model: "scripted", effort: "high", permissionMode: "auto" })
  expect(starts[0]?.options).toEqual({ model: "scripted", effort: "high", permissionMode: "auto" })
})

const failedTurn: readonly ScriptedElement[] = [
  running,
  { type: "error", message: "There's an issue with the selected model", raw: null },
  idle,
]

test.each([
  ["ends its first turn with an error", failedTurn],
  ["stops before its first turn ends", [running, scriptedFailure("exit code 1")]],
])(
  "a run started after a change that %s offers the previous options back, with the message",
  async (_, turn) => {
    const { failed, after } = await withServer(newDatabase(), [answered("one"), turn], (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilIdle(client, session.id)
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "not-a-model" },
        })
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m2",
          text: "again",
        })
        const failed = yield* until(
          sessionOf(client, session.id),
          (listed) => listed?.relaunchFailure != null,
        )
        const after = yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted" },
        })
        return { failed, after }
      }),
    )

    expect(failed?.relaunchFailure).toEqual({ previous: defaults, message: "again" })
    expect(after.relaunchFailure).toBeNull()
  },
)

test("a failed first run with no earlier change offers nothing back", async () => {
  const session = await withServer(newDatabase(), [failedTurn], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
      yield* untilIdle(client, session.id)
      return yield* sessionOf(client, session.id)
    }),
  )

  expect(session?.relaunchFailure).toBeNull()
})

test("changing the run options of a missing session fails with SessionNotFound", async () => {
  const error = await withServer(newDatabase(), [], (client) =>
    client["session.setRunOptions"]({ sessionId: "nope", options: { model: "x" } }).pipe(
      Effect.flip,
    ),
  )

  expect(error._tag).toBe("SessionNotFound")
})
