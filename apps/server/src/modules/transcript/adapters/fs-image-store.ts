import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { Clock, Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import type { ImageMediaType } from "@ivin/contracts/transcript"
import { imageFileName } from "../rules/image-file-name.ts"
import { ImageFolder } from "../usecases/image-folder.ts"
import { ImageStore, type StoredImageSelection } from "../usecases/image-store.ts"
import { isDecodable, toWebpOffThread } from "./webp-encoder.ts"

type StoredRow = {
  id: string
  session_id: string
  media_type: ImageMediaType
  compressed_media_type: ImageMediaType | null
}

// One folder per session: `<folder>/<sessionId>/<imageId>.<ext>`; the rows keep the numbers.
export const layerFsImageStore = Layer.effect(ImageStore)(
  Effect.gen(function* () {
    const db = yield* Database
    const { path: folder } = yield* ImageFolder
    const sessionFolder = (sessionId: string) => join(folder, sessionId)
    const storedFile = (row: StoredRow) =>
      join(
        sessionFolder(row.session_id),
        imageFileName(row.id, row.compressed_media_type ?? row.media_type),
      )
    const selected = ({ sentBefore, exceptSessions }: StoredImageSelection) => {
      const except = exceptSessions === null ? null : JSON.stringify(exceptSessions)
      return db
        .prepare(
          `SELECT id, session_id, media_type, compressed_media_type FROM images
           WHERE deleted_at IS NULL AND (? IS NULL OR sent_at < ?)
             AND (? IS NULL OR session_id NOT IN (SELECT value FROM json_each(?)))`,
        )
        .all(sentBefore, sentBefore, except, except) as StoredRow[]
    }
    const spaceOf = (rows: readonly StoredRow[]) => ({
      images: rows.length,
      bytes: rows.reduce(
        (sum, row) => sum + (statSync(storedFile(row), { throwIfNoEntry: false })?.size ?? 0),
        0,
      ),
    })

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
      save: (sessionId, sentAt, images) =>
        Effect.sync(() => {
          if (images.length === 0) return
          mkdirSync(sessionFolder(sessionId), { recursive: true })
          const insert = db.prepare(
            "INSERT INTO images (id, session_id, number, media_type, sent_at) VALUES (?, ?, ?, ?, ?)",
          )
          for (const { id, number, mediaType, base64 } of images) {
            const file = join(sessionFolder(sessionId), imageFileName(id, mediaType))
            if (relative(sessionFolder(sessionId), file).includes(sep))
              throw new Error(`Image id ${JSON.stringify(id)} leaves the session's folder`)
            writeFileSync(file, Buffer.from(base64, "base64"))
            insert.run(id, sessionId, number, mediaType, sentAt)
          }
        }),
      uncompressed: (sessionId) =>
        Effect.sync(() =>
          (
            db
              .prepare(
                `SELECT id, media_type FROM images
                 WHERE session_id = ? AND compressed_media_type IS NULL AND deleted_at IS NULL
                 ORDER BY number`,
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
          const deleted = db
            .prepare("SELECT 1 FROM images WHERE id = ? AND deleted_at IS NOT NULL")
            .get(imageId)
          if (deleted) return
          const markCompressed = db.prepare(
            "UPDATE images SET compressed_media_type = ? WHERE id = ?",
          )
          // Marked even when the original stays, so the next close does not encode it again.
          if (webp.byteLength >= bytes.byteLength)
            return void markCompressed.run(mediaType, imageId)
          writeFileSync(join(sessionFolder(sessionId), imageFileName(imageId, "image/webp")), webp)
          markCompressed.run("image/webp", imageId)
          rmSync(original, { force: true })
        }),
      space: (selection) => Effect.sync(() => spaceOf(selected(selection))),
      remove: (selection) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          return yield* Effect.sync(() => {
            const rows = selected(selection)
            const freed = spaceOf(rows)
            const markDeleted = db.prepare("UPDATE images SET deleted_at = ? WHERE id = ?")
            for (const row of rows) {
              markDeleted.run(now, row.id)
              rmSync(storedFile(row), { force: true })
            }
            return { ...freed, imageIds: rows.map((row) => row.id) }
          })
        }),
      removeSession: (sessionId) =>
        Effect.sync(() => rmSync(sessionFolder(sessionId), { recursive: true, force: true })),
    }
  }),
)
