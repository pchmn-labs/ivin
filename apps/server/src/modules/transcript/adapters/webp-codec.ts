import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, join } from "node:path"
import decodeJpeg, { init as initJpeg } from "@jsquash/jpeg/decode.js"
import decodePng, { init as initPng } from "@jsquash/png/decode.js"
import encodeWebp, { init as initWebp } from "@jsquash/webp/encode.js"

const require = createRequire(import.meta.url)
// The server's TypeScript libs leave out WebAssembly, which Node has.
const { WebAssembly } = globalThis as unknown as {
  WebAssembly: { compile: (bytes: Uint8Array) => Promise<object> }
}

// The server bundle carries the codecs beside the worker (`tsdown.config.ts`); the sources read them from node_modules.
const compileWasm = (specifier: string) => {
  const bundled = join(import.meta.dirname, "wasm", basename(specifier))
  return WebAssembly.compile(
    readFileSync(existsSync(bundled) ? bundled : require.resolve(specifier)),
  )
}

let ready: Promise<unknown> | undefined
const loadCodecs = () =>
  (ready ??= Promise.all([
    compileWasm("@jsquash/png/codec/pkg/squoosh_png_bg.wasm").then(initPng),
    compileWasm("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm").then(initJpeg),
    compileWasm("@jsquash/webp/codec/enc/webp_enc_simd.wasm").then(initWebp),
  ]))

const arrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const decoders = {
  "image/png": (bytes: Uint8Array) => decodePng(arrayBuffer(bytes)),
  "image/jpeg": (bytes: Uint8Array) =>
    decodeJpeg(arrayBuffer(bytes), { preserveOrientation: true }),
}

export type DecodableMediaType = keyof typeof decoders

export const toWebp = async (bytes: Uint8Array, mediaType: DecodableMediaType) => {
  await loadCodecs()
  const image = await decoders[mediaType](bytes)
  // Sharp YUV keeps the edges of a screenshot's coloured text from bleeding.
  return new Uint8Array(await encodeWebp(image, { quality: 85, use_sharp_yuv: 1 }))
}
