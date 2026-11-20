import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import { Database } from "../../../shared/adapters/database.ts"
import { imageFileName } from "../rules/image-file-name.ts"
import { ImageFolder } from "../usecases/image-folder.ts"
import { ImageStore } from "../usecases/image-store.ts"

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
      removeSession: (sessionId) =>
        Effect.sync(() => rmSync(sessionFolder(sessionId), { recursive: true, force: true })),
    }
  }),
)
