import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedOptions, type ScriptedSend } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
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
  number: 1,
  mediaType: "image/png",
  base64: "iVBORw0KGgoAAAANSUhEUg==",
}
const photo: ImageData = {
  id: "i2",
  number: 2,
  mediaType: "image/jpeg",
  base64: "/9j/4AAQSkZJRgABAQ==",
}

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return db
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newFolder = () => mkdtempSync(join(tmpdir(), "ivin-images-"))

const withServer = <A, E>(
  db: DatabaseSync,
  sent: ScriptedSend[],
  use: (client: Client) => Effect.Effect<A, E>,
  options: ScriptedOptions = {},
  folder = newFolder(),
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(Layer.succeed(ImageFolder)({ path: folder })),
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

test("a message with two images stores two files, references them, and hands them to the harness", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const sent: ScriptedSend[] = []
  const { page, sessionId } = await withServer(
    db,
    sent,
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "what is this? [Image #1] [Image #2]",
          images: [screenshot, photo],
        })
        return { page: yield* endOfTranscript(client, session.id), sessionId: session.id }
      }),
    {},
    folder,
  )

  const stored = db.prepare("SELECT id, number, media_type FROM images ORDER BY id").all()
  expect(stored).toEqual([
    { id: "i1", number: 1, media_type: "image/png" },
    { id: "i2", number: 2, media_type: "image/jpeg" },
  ])
  expect(page.items[0]).toMatchObject({
    role: "user",
    text: "what is this? [Image #1] [Image #2]",
    images: [
      { id: "i1", number: 1, mediaType: "image/png" },
      { id: "i2", number: 2, mediaType: "image/jpeg" },
    ],
  })
  expect(sent.map((s) => s.images)).toEqual([[screenshot, photo]])
  expect(readFileSync(join(folder, sessionId, "i1.png")).toString("base64")).toBe(screenshot.base64)
  expect(readFileSync(join(folder, sessionId, "i2.jpg")).toString("base64")).toBe(photo.base64)
})

test("a page of transcript items carries image references, not image bytes", async () => {
  const page = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
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
        const session = yield* client["session.create"]({ projectPath: "/p" })
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

test("the session's images are listed in transcript order, and the session knows its last number", async () => {
  const third: ImageData = { ...screenshot, id: "i3", number: 3 }
  const { images, session } = await withServer(
    newDatabase(),
    [],
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({
          sessionId: created.id,
          messageId: "m1",
          text: "[Image #2] then [Image #1]",
          images: [photo, screenshot],
        })
        yield* client["session.sendMessage"]({
          sessionId: created.id,
          messageId: "m2",
          text: "and [Image #3]",
          images: [third],
        })
        return {
          images: yield* client["transcript.listImages"]({ sessionId: created.id }),
          session: (yield* client["session.list"]({ projectPath: "/p" }))[0],
        }
      }),
    { cycle: true },
  )

  expect(images.map(({ id, number, messageId }) => ({ id, number, messageId }))).toEqual([
    { id: "i2", number: 2, messageId: "m1" },
    { id: "i1", number: 1, messageId: "m1" },
    { id: "i3", number: 3, messageId: "m2" },
  ])
  expect(images[2]?.messageText).toBe("and [Image #3]")
  expect(session?.lastImageNumber).toBe(3)
})

test("deleting a session deletes its images", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const sessionId = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "[Image #1]",
          images: [screenshot],
        })
        yield* client["session.delete"]({ sessionId: session.id })
        return session.id
      }),
    {},
    folder,
  )

  expect(existsSync(join(folder, sessionId))).toBe(false)
  expect(db.prepare("SELECT COUNT(*) AS count FROM images").get()).toEqual({ count: 0 })
})

test("at start, the server deletes the images of sessions that no longer exist", async () => {
  const folder = newFolder()
  mkdirSync(join(folder, "gone"))
  writeFileSync(join(folder, "gone", "i1.png"), "x")

  await withServer(newDatabase(), [], () => Effect.void, {}, folder)

  expect(existsSync(join(folder, "gone"))).toBe(false)
})
