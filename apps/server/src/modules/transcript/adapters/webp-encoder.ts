import { existsSync } from "node:fs"
import { join } from "node:path"
import { Worker } from "node:worker_threads"
import type { DecodableMediaType } from "./webp-codec.ts"

const DECODABLE: readonly string[] = ["image/png", "image/jpeg"] satisfies DecodableMediaType[]

export const isDecodable = (mediaType: string): mediaType is DecodableMediaType =>
  DECODABLE.includes(mediaType)

// Packaged, the worker and its codecs sit unpacked beside the asar (`electron-builder.yml`), where a worker can read them.
const workerFile = () => {
  const bundled = join(
    import.meta.dirname.replace(/app\.asar(?=[/\\])/, "app.asar.unpacked"),
    "webp-worker.js",
  )
  return existsSync(bundled) ? bundled : join(import.meta.dirname, "webp-worker.ts")
}

// Encoding a large screenshot takes most of a second, which would stall every RPC on this thread.
export const toWebpOffThread = (bytes: Uint8Array, mediaType: DecodableMediaType) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(workerFile(), { workerData: { bytes, mediaType } })
    worker.once("message", resolve)
    worker.once("error", reject)
    worker.once("exit", (code) => reject(new Error(`the WebP worker exited with code ${code}`)))
  })
