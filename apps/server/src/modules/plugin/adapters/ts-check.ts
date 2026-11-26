import { existsSync } from "node:fs"
import { join } from "node:path"
import { Worker } from "node:worker_threads"
import { pluginTypePaths, typescriptFile, unpackedFolder } from "./plugin-types.ts"

// The compiler runs in a worker, so a check never holds up the server's other requests.
const workerFile = () => {
  const bundled = join(unpackedFolder, "ts-check-worker.js")
  return existsSync(bundled) ? bundled : join(import.meta.dirname, "ts-check-worker.ts")
}

export const checkTypes = (folder: string) =>
  new Promise<ReadonlyArray<string>>((resolve, reject) => {
    const worker = new Worker(workerFile(), {
      workerData: { folder, typescript: typescriptFile(), paths: pluginTypePaths() },
    })
    worker.once("message", (result: { lines: string[] } | { failure: string }) =>
      "lines" in result ? resolve(result.lines) : reject(new Error(result.failure)),
    )
    worker.once("error", reject)
    worker.once("exit", (code) => reject(new Error(`the type checker exited with code ${code}`)))
  })
