import { Worker } from "node:worker_threads"
import { checkWorkerFile, pluginTypePaths, typescriptFile } from "./plugin-types.ts"

// The compiler runs in a worker, so a check never holds up the server's other requests.
export const checkTypes = (folder: string, toolsFolder: string | undefined) =>
  new Promise<ReadonlyArray<string>>((resolve, reject) => {
    const worker = new Worker(checkWorkerFile(toolsFolder), {
      workerData: {
        folder,
        typescript: typescriptFile(toolsFolder),
        paths: pluginTypePaths(toolsFolder),
      },
    })
    worker.once("message", (result: { lines: string[] } | { failure: string }) =>
      "lines" in result ? resolve(result.lines) : reject(new Error(result.failure)),
    )
    worker.once("error", reject)
    worker.once("exit", (code) => reject(new Error(`the type checker exited with code ${code}`)))
  })
