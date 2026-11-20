import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import type { ImageMediaType } from "@ivin/contracts/transcript"
import { imageFileName } from "../rules/image-file-name.ts"
import { ImageFolder } from "../usecases/image-folder.ts"
import { ImageStore } from "../usecases/image-store.ts"
import { isDecodable, toWebpOffThread } from "./webp-encoder.ts"

// One folder per session: `<folder>/<sessionId>/<imageId>.<ext>`; the rows keep the numbers.
export const layerFsImageStore = Layer.effect(ImageStore)(
  Effect.gen(function* () {
    const db = yield* Database
    const { path: folder } = yield* ImageFolder
    const sessionFolder = (sessionId: string) => join(folder, sessionId)

    // A crash between deleting a session's rows and its folder leaves the folder behind.
    yield* Effect.sync(() => {
      mkdirSync(folder, { recursive: true })
      const known = db.prepare("SELECT 1 FROM sessions WHERE id = ?")
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.isDirectory() && !known.get(entry.name))
          rmSync(join(folder, entry.name), { recursive: true, force: true })
      }
    })

    return {
      save: (sessionId, images) =>
        Effect.sync(() => {
          if (images.length === 0) return
          mkdirSync(sessionFolder(sessionId), { recursive: true })
          const insert = db.prepare(
            "INSERT INTO images (id, session_id, number, media_type) VALUES (?, ?, ?, ?)",
          )
          for (const { id, number, mediaType, base64 } of images) {
            writeFileSync(
              join(sessionFolder(sessionId), imageFileName(id, mediaType)),
              Buffer.from(base64, "base64"),
            )
            insert.run(id, sessionId, number, mediaType)
          }
        }),
      uncompressed: (sessionId) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT id, media_type FROM images
                 WHERE session_id = ? AND compressed_media_type IS NULL ORDER BY number`,
              )
              .all(sessionId) as { id: string; media_type: string }[]
          )
            .filter((row) => isDecodable(row.media_type))
            .map((row) => row.id),
        ),
      compress: (sessionId, imageId) =>
        Effect.tryPromise(async () => {
          const row = db
            .prepare("SELECT media_type FROM images WHERE id = ? AND session_id = ?")
            .get(imageId, sessionId) as { media_type: ImageMediaType } | undefined
          if (!row || !isDecodable(row.media_type)) return
          const mediaType = row.media_type
          const original = join(sessionFolder(sessionId), imageFileName(imageId, mediaType))
          const bytes = readFileSync(original)
          const webp = await toWebpOffThread(bytes, mediaType)
          const markCompressed = db.prepare(
            "UPDATE images SET compressed_media_type = ? WHERE id = ?",
          )
          // A WebP no smaller than the original is dropped, and the image counts as compressed.
          if (webp.byteLength >= bytes.byteLength)
            return void markCompressed.run(mediaType, imageId)
          writeFileSync(join(sessionFolder(sessionId), imageFileName(imageId, "image/webp")), webp)
          markCompressed.run("image/webp", imageId)
          rmSync(original, { force: true })
        }),
      removeSession: (sessionId) =>
        Effect.sync(() => rmSync(sessionFolder(sessionId), { recursive: true, force: true })),
    }
  }),
)
