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
import { trustEveryFolder } from "./trust-every-folder.ts"
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
  trustEveryFolder(db)
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

test("an image whose id leaves the session's folder is refused and writes no file", async () => {
  const folder = newFolder()
  const escaping: ImageData = { ...screenshot, id: "../../escaped" }

  const exit = await withServer(
    newDatabase(),
    [],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        return yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "look",
          images: [escaping],
        }).pipe(Effect.exit)
      }),
    {},
    join(folder, "images"),
  )

  expect(exit._tag).toBe("Failure")
  expect(existsSync(join(folder, "escaped.png"))).toBe(false)
})

const DAY = 24 * 60 * 60 * 1000

const sendIn = (client: Client, projectPath: string, image: ImageData) =>
  Effect.gen(function* () {
    const session = yield* client["session.create"]({ projectPath })
    yield* client["session.sendMessage"]({
      sessionId: session.id,
      messageId: `m-${image.id}`,
      text: `[Image #${image.number}]`,
      images: [image],
    })
    return session.id
  })

test("the space reported is the size of the image files", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const { space, sessionId } = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const sessionId = yield* sendIn(client, "/p", screenshot)
        yield* sendIn(client, "/q", photo)
        return { space: yield* client["transcript.getImageSpace"]({}), sessionId }
      }),
    { cycle: true },
    folder,
  )

  const screenshotBytes = readFileSync(join(folder, sessionId, "i1.png")).byteLength
  const photoBytes = Buffer.from(photo.base64, "base64").byteLength
  expect(space).toEqual({ images: 2, bytes: screenshotBytes + photoBytes })
})

test("deleting the images older than N days removes exactly those files, and their transcripts still load", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const result = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const oldSession = yield* sendIn(client, "/p", screenshot)
        const newSession = yield* sendIn(client, "/q", photo)
        db.prepare("UPDATE images SET sent_at = sent_at - ? WHERE id = 'i1'").run(31 * DAY)
        const before = yield* client["transcript.getImageSpace"]({ olderThanDays: 30 })
        const freed = yield* client["transcript.deleteImages"]({ olderThanDays: 30 })
        return {
          oldSession,
          newSession,
          before,
          freed,
          after: yield* client["transcript.getImageSpace"]({}),
          oldPage: yield* endOfTranscript(client, oldSession),
          oldImages: yield* client["transcript.listImages"]({ sessionId: oldSession }),
        }
      }),
    { cycle: true },
    folder,
  )

  const screenshotBytes = Buffer.from(screenshot.base64, "base64").byteLength
  const photoBytes = Buffer.from(photo.base64, "base64").byteLength
  expect(result.before).toEqual({ images: 1, bytes: screenshotBytes })
  expect(result.freed).toEqual({ images: 1, bytes: screenshotBytes, imageIds: ["i1"] })
  expect(result.after).toEqual({ images: 1, bytes: photoBytes })
  expect(existsSync(join(folder, result.oldSession, "i1.png"))).toBe(false)
  expect(existsSync(join(folder, result.newSession, "i2.jpg"))).toBe(true)
  expect(db.prepare("SELECT id FROM images WHERE deleted_at IS NOT NULL").all()).toEqual([
    { id: "i1" },
  ])
  expect(result.oldPage.items[0]).toMatchObject({
    role: "user",
    text: "[Image #1]",
    images: [{ id: "i1", number: 1, deleted: true }],
  })
  expect(result.oldImages).toMatchObject([{ id: "i1", deleted: true }])
})

test("deleting all images removes every file, and a session's next image takes the next number", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const result = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const sessionId = yield* sendIn(client, "/p", screenshot)
        yield* sendIn(client, "/q", photo)
        const freed = yield* client["transcript.deleteImages"]({})
        return {
          freed,
          after: yield* client["transcript.getImageSpace"]({}),
          session: (yield* client["session.list"]({ projectPath: "/p" }))[0],
          sessionId,
        }
      }),
    { cycle: true },
    folder,
  )

  expect(result.freed.images).toBe(2)
  expect(result.after).toEqual({ images: 0, bytes: 0 })
  expect(existsSync(join(folder, result.sessionId, "i1.png"))).toBe(false)
  expect(result.session?.lastImageNumber).toBe(1)
})

test("deleting a session whose images were deleted removes their rows and its folder", async () => {
  const db = newDatabase()
  const folder = newFolder()
  const sessionId = await withServer(
    db,
    [],
    (client) =>
      Effect.gen(function* () {
        const sessionId = yield* sendIn(client, "/p", screenshot)
        yield* client["transcript.deleteImages"]({})
        yield* client["session.delete"]({ sessionId })
        return sessionId
      }),
    { cycle: true },
    folder,
  )

  expect(existsSync(join(folder, sessionId))).toBe(false)
  expect(db.prepare("SELECT COUNT(*) AS count FROM images").get()).toEqual({ count: 0 })
})
