import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, Logger, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ITEMS_VERSION } from "../modules/transcript/rules/derive-items.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

const insertSession = (db: DatabaseSync, id: string, stored: Record<string, string> = {}) => {
  const columns = {
    id,
    project_path: "/p",
    working_folder: "/p",
    title: id,
    harness: "scripted",
    model: "m",
    effort: "e",
    permission_mode: "p",
    run_options_at: 1,
    status: "idle",
    status_changed_at: 1,
    created_at: 1,
    last_activity_at: 1,
    ...stored,
  }
  const names = Object.keys(columns)
  db.prepare(
    `INSERT INTO sessions (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
  ).run(...Object.values(columns))
}

const insertItem = (db: DatabaseSync, id: string, sessionId: string, payload: object) =>
  db
    .prepare(
      "INSERT INTO transcript_items (id, session_id, position, type, payload) VALUES (?, ?, ?, 'thinking', ?)",
    )
    .run(id, sessionId, 1, JSON.stringify(payload))

const insertEvent = (db: DatabaseSync, id: string, sequence: number, payload: object) =>
  db
    .prepare(
      "INSERT INTO transcript_events (id, session_id, sequence, type, at, payload) VALUES (?, 's2', ?, ?, 1, ?)",
    )
    .run(id, sequence, (payload as { type: string }).type, JSON.stringify(payload))

const thinking = (id: string, sessionId: string, position: number) => ({
  id,
  sessionId,
  position,
  at: 0,
  type: "thinking",
  text: id,
})

const seed = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  insertSession(db, "s1")
  insertSession(db, "s2", {
    // Stored before the agent's error was kept.
    relaunch_failure: JSON.stringify({
      previous: { model: "m", effort: "e", permissionMode: "p" },
      message: "hi",
    }),
  })
  insertSession(db, "s3", {
    relaunch_failure: JSON.stringify({ previous: 1 }),
    pending_messages: JSON.stringify([{ id: 1 }]),
  })
  db.prepare("INSERT INTO transcript_item_states (session_id, version) VALUES ('s1', ?)").run(
    ITEMS_VERSION,
  )
  insertItem(db, "good", "s1", thinking("good", "s1", 1))
  insertItem(db, "bad", "s1", { id: "bad", type: "thinking" })
  insertEvent(db, "e-good", 1, { type: "interruption" })
  insertEvent(db, "e-bad", 2, { type: "user_message" })
  return db
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type RpcClient = Effect.Success<ReturnType<typeof makeClient>>

const run = async <A>(db: DatabaseSync, use: (client: RpcClient) => Effect.Effect<A, unknown>) => {
  const logged: string[] = []
  const logger = Logger.make<unknown, void>(({ message }) => {
    logged.push(String(Array.isArray(message) ? message.join(" ") : message))
  })
  const result = await Effect.runPromise(
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
          Layer.provide(layerScripted([])),
          Layer.provideMerge(Logger.layer([logger])),
        ),
      ),
      Effect.scoped,
    ),
  )
  return { result, logged }
}

test("an item that no longer matches its schema is left out, logged once, and the rest shows", async () => {
  const db = seed()

  const { result, logged } = await run(db, (client) =>
    Effect.gen(function* () {
      const page = () =>
        client["transcript.getItems"]({ sessionId: "s1", position: null, before: 50, after: 0 })
      const first = yield* page()
      const watched = yield* client["transcript.watchItems"]({ sessionId: "s1", before: 50 }).pipe(
        Stream.take(1),
        Stream.runCollect,
      )
      yield* page()
      return { first, watched }
    }),
  )

  expect(result.first.items.map((item) => item.id)).toEqual(["good"])
  expect(result.watched[0]).toMatchObject({ type: "page", page: { items: [{ id: "good" }] } })
  expect(logged.filter((line) => line.includes("transcript item bad"))).toHaveLength(1)
})

test("an event that no longer matches its schema is left out of the derived items", async () => {
  const db = seed()

  const { result, logged } = await run(db, (client) =>
    client["transcript.getItems"]({ sessionId: "s2", position: null, before: 50, after: 0 }),
  )

  expect(result.items.map((item) => item.type)).toEqual(["interruption"])
  expect(logged.filter((line) => line.includes("transcript event e-bad"))).toHaveLength(1)
})

test("sessions with messages or run options that no longer match still show, with them empty", async () => {
  const db = seed()

  const { result, logged } = await run(db, (client) =>
    client["session.watch"]({ projectPath: "/p" }).pipe(Stream.take(3), Stream.runCollect),
  )

  const sessions = new Map(
    result.map((change) => [change._tag === "changed" ? change.session.id : "", change]),
  )
  expect(sessions.get("s2")).toMatchObject({
    session: { relaunchFailure: { message: "hi", error: null } },
  })
  expect(sessions.get("s3")).toMatchObject({
    session: { relaunchFailure: null, pendingMessages: [] },
  })
  expect(logged.filter((line) => line.includes("s3"))).toHaveLength(2)
})
