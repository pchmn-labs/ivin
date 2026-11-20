import type { ImageData, ImageMediaType } from "@ivin/contracts/transcript"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { ImageStore } from "../usecases/image-store.ts"

interface ImageRow {
  id: string
  media_type: ImageMediaType
  data: Uint8Array
}

export const layerSqliteImageStore = Layer.effect(ImageStore)(
  Effect.gen(function* () {
    const db = yield* Database
    return {
      save: (sessionId, images) =>
        Effect.sync(() => {
          const insert = db.prepare(
            "INSERT INTO images (id, session_id, media_type, data) VALUES (?, ?, ?, ?)",
          )
          for (const { id, mediaType, base64 } of images)
            insert.run(id, sessionId, mediaType, Buffer.from(base64, "base64"))
        }),
      find: (imageId) =>
        Effect.sync((): ImageData | null => {
          const row = db
            .prepare("SELECT id, media_type, data FROM images WHERE id = ?")
            .get(imageId) as ImageRow | undefined
          if (!row) return null
          return {
            id: row.id,
            mediaType: row.media_type,
            base64: Buffer.from(row.data).toString("base64"),
          }
        }),
    }
  }),
)
