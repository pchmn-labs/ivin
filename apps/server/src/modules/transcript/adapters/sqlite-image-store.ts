import type { ImageFile, ImageMediaType } from "@ivin/contracts/transcript"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { ImageStore } from "../usecases/image-store.ts"

interface ImageRow {
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
            "INSERT INTO images (id, session_id, number, media_type, data) VALUES (?, ?, ?, ?, ?)",
          )
          for (const { id, number, mediaType, base64 } of images)
            insert.run(id, sessionId, number, mediaType, Buffer.from(base64, "base64"))
        }),
      find: (imageId) =>
        Effect.sync((): ImageFile | null => {
          const row = db
            .prepare("SELECT media_type, data FROM images WHERE id = ?")
            .get(imageId) as ImageRow | undefined
          if (!row) return null
          return {
            mediaType: row.media_type,
            base64: Buffer.from(row.data).toString("base64"),
          }
        }),
    }
  }),
)
