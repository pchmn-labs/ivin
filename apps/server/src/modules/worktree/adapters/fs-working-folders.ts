import { Effect, Layer } from "effect"
import { existsSync } from "node:fs"
import { readdir, rm } from "node:fs/promises"
import { WorkingFolders } from "../usecases/working-folders.ts"

export const layerFsWorkingFolders = Layer.succeed(WorkingFolders)({
  exists: (path) => Effect.sync(() => existsSync(path)),
  entries: (path) => Effect.promise(() => readdir(path).catch(() => [])),
  remove: (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
})
