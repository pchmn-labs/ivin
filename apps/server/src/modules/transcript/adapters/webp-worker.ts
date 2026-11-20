import { parentPort, workerData } from "node:worker_threads"
import { type DecodableMediaType, toWebp } from "./webp-codec.ts"

const { bytes, mediaType } = workerData as { bytes: Uint8Array; mediaType: DecodableMediaType }
const webp = await toWebp(bytes, mediaType)
parentPort?.postMessage(webp, [webp.buffer])
