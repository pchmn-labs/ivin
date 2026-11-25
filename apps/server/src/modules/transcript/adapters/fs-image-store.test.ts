import { Effect, Layer } from "effect"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { Database, layerDatabase } from "../../../shared/adapters/database.ts"
import { ImageFolder } from "../usecases/image-folder.ts"
import { ImageStore } from "../usecases/image-store.ts"
import { layerFsImageStore } from "./fs-image-store.ts"

test("saving an image whose id leaves the session's folder fails and writes no file", async () => {
  const root = mkdtempSync(join(tmpdir(), "ivin-images-"))

  const exit = await Effect.gen(function* () {
    const store = yield* ImageStore
    return yield* store
      .save("s1", 0, [{ id: "../../escaped", number: 1, mediaType: "image/png", base64: "AA==" }])
      .pipe(Effect.exit)
  }).pipe(
    Effect.provide(
      layerFsImageStore.pipe(
        Layer.provide(layerDatabase(":memory:")),
        Layer.provide(Layer.succeed(ImageFolder)({ path: join(root, "images") })),
      ),
    ),
    Effect.runPromise,
  )

  expect(exit._tag).toBe("Failure")
  expect(existsSync(join(root, "escaped.png"))).toBe(false)
})

test("a deleted image is left out of the images to compress", async () => {
  const root = mkdtempSync(join(tmpdir(), "ivin-images-"))

  const uncompressed = await Effect.gen(function* () {
    const db = yield* Database
    db.exec(
      `INSERT INTO sessions (id, project_path, working_folder, title, created_at, last_activity_at)
       VALUES ('s1', '/p', '/p', 't', 0, 0)`,
    )
    const store = yield* ImageStore
    yield* store.save("s1", 10, [{ id: "i1", number: 1, mediaType: "image/png", base64: "AA==" }])
    yield* store.remove(null)
    return yield* store.uncompressed("s1")
  }).pipe(
    Effect.provide(
      layerFsImageStore.pipe(
        Layer.provideMerge(layerDatabase(":memory:")),
        Layer.provide(Layer.succeed(ImageFolder)({ path: join(root, "images") })),
      ),
    ),
    Effect.runPromise,
  )

  expect(uncompressed).toEqual([])
})
