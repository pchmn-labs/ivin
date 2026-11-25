import { Effect } from "effect"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import { FolderReader } from "../usecases/folder-reader.ts"
import { layerFsFolderReader } from "./fs-folder-reader.ts"

let folder: string

beforeEach(() => {
  folder = realpathSync(mkdtempSync(join(tmpdir(), "ivin-fs-reader-")))
})

afterEach(() => rmSync(folder, { recursive: true, force: true }))

const walk = (limit: number) =>
  Effect.runPromise(
    FolderReader.use((reader) => reader.walkFiles(folder, limit)).pipe(
      Effect.provide(layerFsFolderReader),
    ),
  )

test("walking stops once it has found more files than the limit", async () => {
  mkdirSync(join(folder, "nested"))
  for (const name of ["a", "b", "c", "d", "nested/e"]) writeFileSync(join(folder, name), "")

  expect(await walk(3)).toHaveLength(4)
})
