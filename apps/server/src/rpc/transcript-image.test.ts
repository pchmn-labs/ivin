import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedOptions, type ScriptedSend } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "A cat.", raw: null },
  { type: "status", status: "idle", raw: null },
]

const screenshot: ImageData = {
  id: "i1",
  mediaType: "image/png",
  base64: "iVBORw0KGgoAAAANSUhEUg==",
}
const photo: ImageData = { id: "i2", mediaType: "image/jpeg", base64: "/9j/4AAQSkZJRgABAQ==" }

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return db
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  db: DatabaseSync,
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
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([turn], { ...options, sent })),
        ),
      ),
      Effect.scoped,
    ),
  )

const endOfTranscript = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 0 })

test("a message with two images stores two blobs, references them, and hands them to the harness", async () => {
  const db = newDatabase()
  const sent: ScriptedSend[] = []
  const { page, fetched } = await withServer(db, sent, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "what is this?",
        images: [screenshot, photo],
      })
      return {
        page: yield* endOfTranscript(client, session.id),
        fetched: yield* client["transcript.getImage"]({ imageId: "i2" }),
      }
    }),
  )

  const stored = db.prepare("SELECT id, media_type FROM images ORDER BY id").all()
  expect(stored).toEqual([
    { id: "i1", media_type: "image/png" },
    { id: "i2", media_type: "image/jpeg" },
  ])
  expect(page.items[0]).toMatchObject({
    role: "user",
    text: "what is this?",
    images: [
      { id: "i1", mediaType: "image/png" },
      { id: "i2", mediaType: "image/jpeg" },
    ],
  })
  expect(sent.map((s) => s.images)).toEqual([[screenshot, photo]])
  expect(fetched).toEqual(photo)
})

test("a page of transcript items carries image references, not image bytes", async () => {
  const page = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "look",
        images: [screenshot],
      })
      return yield* endOfTranscript(client, session.id)
    }),
  )

  expect(JSON.stringify(page)).not.toContain(screenshot.base64)
})

test("a message stored before images existed comes back with no images", async () => {
  const db = newDatabase()
  db.prepare(
    `INSERT INTO sessions (id, project_path, working_folder, title, created_at, last_activity_at)
     VALUES ('s', '/p', '/p', 't', 0, 0)`,
  ).run()
  db.prepare(
    `INSERT INTO transcript_events (id, session_id, sequence, type, at, payload)
     VALUES ('m1', 's', 1, 'user_message', 0, '{"type":"user_message","text":"hi","raw":null}')`,
  ).run()

  const page = await withServer(db, [], (client) => endOfTranscript(client, "s"))

  expect(page.items).toMatchObject([{ role: "user", text: "hi", images: [] }])
})

test("a message whose harness cannot start keeps its images", async () => {
  const db = newDatabase()
  const page = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "",
          images: [screenshot],
        })
        return yield* endOfTranscript(client, session.id)
      }),
    { startFailure: "no agent" },
  )

  expect(page.items[0]).toMatchObject({ role: "user", images: [{ id: "i1" }] })
})

test("fetching an unknown image fails with ImageNotFound", async () => {
  const error = await withServer(newDatabase(), [], (client) =>
    client["transcript.getImage"]({ imageId: "nope" }).pipe(Effect.flip),
  )

  expect(error._tag).toBe("ImageNotFound")
})
