import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { crc32, deflateSync } from "node:zlib"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageCompression } from "../modules/tab/usecases/image-compression.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"
import { handlers, layerServices } from "./handlers.ts"

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "status", status: "idle", raw: null },
]

const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

// An RGB gradient with grain, which PNG stores at nearly its raw size.
const photoLikePng = (width: number, height: number) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const rows = Buffer.alloc((width * 3 + 1) * height)
  let seed = 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const at = y * (width * 3 + 1) + 1 + x * 3
      rows.set([x & 0xff, y & 0xff, (x + y + (seed % 32)) & 0xff], at)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const png = photoLikePng(256, 256)
const screenshot: ImageData = {
  id: "i1",
  number: 1,
  mediaType: "image/png",
  base64: png.toString("base64"),
}
const undecodable: ImageData = {
  id: "i2",
  number: 1,
  mediaType: "image/png",
  base64: "iVBORw0KGgoAAAANSUhEUg==",
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  db: DatabaseSync,
  folder: string,
  use: (client: Client) => Effect.Effect<A, E, ImageCompression>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provideMerge(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(Layer.succeed(ImageFolder)({ path: folder })),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([turn], { cycle: true })),
        ),
      ),
      Effect.scoped,
    ),
  )

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return db
}

const sessionWithImage = (client: Client, image: ImageData) =>
  Effect.gen(function* () {
    const session = yield* client["session.create"]({ projectPath: "/p" })
    yield* client["tab.open"]({ sessionId: session.id })
    yield* client["session.sendMessage"]({
      sessionId: session.id,
      messageId: `m-${image.id}`,
      text: "[Image #1]",
      images: [image],
    })
    return session.id
  })

const closeTab = (client: Client, sessionId: string) =>
  Effect.gen(function* () {
    const tabs = yield* client["tab.close"]({ sessionId })
    yield* (yield* ImageCompression).settled
    return tabs
  })

const imageOfTranscript = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 0 }).pipe(
    Effect.map((page) => {
      const message = page.items.find((item) => item.type === "message")
      return message?.type === "message" ? message.images[0] : undefined
    }),
  )

test(
  "closing a session's last tab replaces its PNG with a smaller WebP that its image reference reaches",
  { timeout: 10_000 },
  async () => {
    const folder = mkdtempSync(join(tmpdir(), "ivin-images-"))
    const { sessionId, image, listed } = await withServer(newDatabase(), folder, (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: "/p" })
        const sessionId = yield* sessionWithImage(client, screenshot)
        yield* closeTab(client, sessionId)
        return {
          sessionId,
          image: yield* imageOfTranscript(client, sessionId),
          listed: yield* client["transcript.listImages"]({ sessionId }),
        }
      }),
    )

    expect(image).toMatchObject({ id: "i1", mediaType: "image/webp" })
    expect(listed[0]?.mediaType).toBe("image/webp")
    expect(readdirSync(join(folder, sessionId))).toEqual(["i1.webp"])
    const stored = readFileSync(join(folder, sessionId, "i1.webp"))
    expect(stored.subarray(0, 4).toString("ascii")).toBe("RIFF")
    expect(stored.subarray(8, 12).toString("ascii")).toBe("WEBP")
    expect(stored.byteLength).toBeLessThan(png.byteLength)
  },
)

test(
  "closing one tab leaves the images of a session whose tab is still open as they were",
  { timeout: 10_000 },
  async () => {
    const folder = mkdtempSync(join(tmpdir(), "ivin-images-"))
    const { open, image } = await withServer(newDatabase(), folder, (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: "/p" })
        const open = yield* sessionWithImage(client, screenshot)
        const closed = yield* sessionWithImage(client, { ...screenshot, id: "i3" })
        yield* closeTab(client, closed)
        return { open, image: yield* imageOfTranscript(client, open) }
      }),
    )

    expect(image?.mediaType).toBe("image/png")
    expect(readFileSync(join(folder, open, "i1.png"))).toEqual(png)
  },
)

test(
  "an image that cannot be decoded is left as it was, and its tab still closes",
  { timeout: 10_000 },
  async () => {
    const folder = mkdtempSync(join(tmpdir(), "ivin-images-"))
    const db = newDatabase()
    const { sessionId, tabs } = await withServer(db, folder, (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: "/p" })
        const sessionId = yield* sessionWithImage(client, undecodable)
        return { sessionId, tabs: yield* closeTab(client, sessionId) }
      }),
    )

    expect(tabs.tabs).toEqual([])
    expect(readFileSync(join(folder, sessionId, "i2.png")).toString("base64")).toBe(
      undecodable.base64,
    )
    expect(existsSync(join(folder, sessionId, "i2.webp"))).toBe(false)
    expect(db.prepare("SELECT compressed_media_type FROM images").get()).toEqual({
      compressed_media_type: null,
    })
  },
)
