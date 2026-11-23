import { Effect, Layer } from "effect"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { layerDatabase } from "../../../shared/adapters/database.ts"
import { ImageFolder } from "../usecases/image-folder.ts"
import { ImageStore } from "../usecases/image-store.ts"
import { layerFsImageStore } from "./fs-image-store.ts"

test("saving an image whose id leaves the session's folder fails and writes no file", async () => {
  const root = mkdtempSync(join(tmpdir(), "ivin-images-"))

  const exit = await Effect.gen(function* () {
    const store = yield* ImageStore
    return yield* store
      .save("s1", [{ id: "../../escaped", number: 1, mediaType: "image/png", base64: "AA==" }])
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
