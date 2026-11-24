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
import { Deferred, Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
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
const started = (taskId = "k1", kind: "agent" | "command" = "command"): HarnessOutput => ({
  type: "task_started",
  taskId,
  toolCallId: `call-${taskId}`,
  kind,
  description: `Task ${taskId}`,
  raw: null,
})
const ended = (taskId = "k1"): HarnessOutput => ({
  type: "task_ended",
  taskId,
  outcome: "completed",
  summary: "done",
  output: null,
  raw: null,
})
const outputFile = (taskId = "k1"): HarnessOutput => ({
  type: "task_output_file",
  taskId,
  path: `/tasks/${taskId}.output`,
})
// The turn that starts a task and ends while it still runs.
const turn: ScriptedElement[] = [running, started(), said("started it"), idle]

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
  options: ScriptedOptions,
  use: (client: Client) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServicesWith(layerSessionRunsWith("20 millis"))),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted(turns, options)),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400; attempt++) {
      const value = yield* read
      if (done(value)) return value
      yield* Effect.sleep("5 millis")
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

const gate = () => Effect.runSync(Deferred.make<void>())

const send = (client: Client, sessionId: string, messageId = "m1") =>
  client["session.sendMessage"]({ sessionId, messageId, text: "go" })

const itemsOf = (db: DatabaseSync, sessionId: string, type: string) =>
  (
    db
      .prepare(
        "SELECT payload FROM transcript_items WHERE session_id = ? AND type = ? ORDER BY position",
      )
      .all(sessionId, type) as { payload: string }[]
  ).map((row) => JSON.parse(row.payload) as Record<string, unknown>)

test("a turn that ends while a task runs leaves the session in background, listing the task and its item", async () => {
  const db = newDatabase()
  const session = await withServer(db, [turn], {}, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, created.id)
      return yield* untilSession(client, created.id, (s) => s.status === "in_background")
    }),
  )
  const [item] = itemsOf(db, session.id, "task")
  expect(session.backgroundTasks).toEqual([
    {
      taskId: "k1",
      kind: "command",
      description: "Task k1",
      itemId: item!["id"],
      toolCallId: item!["toolCallId"],
      at: item!["at"],
    },
  ])
})

test("the turn the agent starts after a task ends makes the session working again, then idle", async () => {
  const db = newDatabase()
  const first = gate()
  const second = gate()
  const result = await withServer(
    db,
    [
      [
        ...turn,
        scriptedLater(first, [ended(), running, said("it finished")]),
        scriptedLater(second, [idle]),
      ],
    ],
    {},
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, created.id)
        yield* untilSession(client, created.id, (s) => s.status === "in_background")
        yield* Deferred.succeed(first, undefined)
        const working = yield* untilSession(client, created.id, (s) => s.status === "working")
        yield* Deferred.succeed(second, undefined)
        const after = yield* untilSession(client, created.id, (s) => s.status === "idle")
        return { working: working.backgroundTasks, after: after.backgroundTasks }
      }),
  )
  expect(result).toEqual({ working: [], after: [] })
})

test("the last task ending with no turn running sets the session idle", async () => {
  const db = newDatabase()
  const done = gate()
  const session = await withServer(db, [[...turn, scriptedLater(done, [ended()])]], {}, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, created.id)
      yield* untilSession(client, created.id, (s) => s.status === "in_background")
      yield* Deferred.succeed(done, undefined)
      return yield* untilSession(client, created.id, (s) => s.status === "idle")
    }),
  )
  expect(session.backgroundTasks).toEqual([])
})

test("a session stays in background until its last task ends", async () => {
  const db = newDatabase()
  const first = gate()
  const second = gate()
  const result = await withServer(
    db,
    [
      [
        running,
        started("k1"),
        started("k2", "agent"),
        idle,
        scriptedLater(first, [ended("k1")]),
        scriptedLater(second, [ended("k2")]),
      ],
    ],
    {},
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, created.id)
        const both = yield* untilSession(client, created.id, (s) => s.backgroundTasks.length === 2)
        yield* Deferred.succeed(first, undefined)
        const one = yield* untilSession(client, created.id, (s) => s.backgroundTasks.length === 1)
        yield* Deferred.succeed(second, undefined)
        const none = yield* untilSession(client, created.id, (s) => s.status === "idle")
        return [both.status, one.status, one.backgroundTasks[0]?.taskId, none.status]
      }),
  )
  expect(result).toEqual(["in_background", "in_background", "k2", "idle"])
})

test("a task that starts during a turn leaves the session working until the turn ends", async () => {
  const db = newDatabase()
  const result = await withServer(db, [[running, started(), said("working")]], {}, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, created.id)
      return yield* untilSession(client, created.id, (s) => s.backgroundTasks.length === 1)
    }),
  )
  expect(result.status).toBe("working")
})

test("a task is an item, ended by its notification with the output its command ended with", async () => {
  const db = newDatabase()
  const done = gate()
  const tasks = await withServer(
    db,
    [[running, started(), outputFile(), idle, scriptedLater(done, [ended()])]],
    { taskOutputs: { "/tasks/k1.output": "built\nfinished\n" } },
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, created.id)
        yield* untilSession(client, created.id, (s) => s.status === "in_background")
        const running = yield* client["session.taskOutput"]({ sessionId: created.id, taskId: "k1" })
        yield* Deferred.succeed(done, undefined)
        yield* untilSession(client, created.id, (s) => s.status === "idle")
        const after = yield* client["session.taskOutput"]({ sessionId: created.id, taskId: "k1" })
        return { running, after, items: itemsOf(db, created.id, "task") }
      }),
  )
  expect(tasks.running).toBe("built\nfinished\n")
  expect(tasks.after).toBeNull()
  expect(tasks.items).toMatchObject([
    { taskId: "k1", status: "completed", summary: "done", output: "built\nfinished\n" },
  ])
})

test("a subagent's steps are stored under its call, and the steps of a call that is no task are not", async () => {
  const db = newDatabase()
  const step = (parent: string): HarnessOutput => ({
    type: "tool_call",
    toolCallId: `${parent}-ls`,
    name: "Bash",
    input: { command: "ls" },
    parentToolCallId: parent,
    raw: null,
  })
  await withServer(
    db,
    [[running, started("k1", "agent"), step("call-k1"), step("foreground"), idle]],
    {},
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        yield* send(client, created.id)
        yield* untilSession(client, created.id, (s) => s.status === "in_background")
        expect(itemsOf(db, created.id, "tool_call")).toMatchObject([
          { toolCallId: "call-k1-ls", parentToolCallId: "call-k1" },
        ])
        const steps = yield* client["transcript.getTaskItems"]({
          sessionId: created.id,
          toolCallId: "call-k1",
        })
        expect(steps).toMatchObject([{ type: "tool_call", toolCallId: "call-k1-ls" }])
      }),
  )
})

test("archiving a session in background stops its agent and ends its tasks", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const result = await withServer(db, [turn], { closed }, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, created.id)
      yield* untilSession(client, created.id, (s) => s.status === "in_background")
      yield* client["session.archive"]({ sessionId: created.id })
      const [archived] = yield* until(
        client["session.listArchived"]({ projectPath: "/p" }),
        (sessions) => sessions.length > 0,
      )
      return { archived: archived!, closed: [...closed], tasks: itemsOf(db, created.id, "task") }
    }),
  )
  expect(result.closed).toHaveLength(1)
  expect(result.archived).toMatchObject({ status: "idle", backgroundTasks: [] })
  expect(result.tasks).toMatchObject([{ status: "stopped" }])
})

test("interrupting a session in background stops its agent and ends its tasks", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const session = await withServer(db, [turn], { closed }, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* send(client, created.id)
      yield* untilSession(client, created.id, (s) => s.status === "in_background")
      yield* client["session.interrupt"]({ sessionId: created.id })
      return yield* untilSession(client, created.id, (s) => s.status === "idle")
    }),
  )
  expect(closed).toHaveLength(1)
  expect(session.backgroundTasks).toEqual([])
})

test("closing the tab of a session in background stops its agent and ends its tasks", async () => {
  const db = newDatabase()
  const closed: string[] = []
  const session = await withServer(db, [turn], { closed }, (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/p" })
      const created = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["tab.open"]({ sessionId: created.id })
      yield* send(client, created.id)
      yield* untilSession(client, created.id, (s) => s.status === "in_background")
      yield* client["tab.close"]({ sessionId: created.id })
      return yield* untilSession(client, created.id, (s) => s.status === "idle")
    }),
  )
  expect(closed).toHaveLength(1)
  expect(session.backgroundTasks).toEqual([])
})
