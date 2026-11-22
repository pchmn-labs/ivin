import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type { PackUserConfig } from "vite-plus/pack"

const pnpmFolder = dirname(createRequire(import.meta.url).resolve("pnpm"))

// Rolldown's native binding for this machine, which the server bundle cannot hold.
const platformTag =
  process.platform === "linux" ? `linux-${process.arch}-gnu` : `${process.platform}-${process.arch}`
const fromRolldown = createRequire(createRequire(import.meta.url).resolve("rolldown"))
const rolldownBinding = join(
  dirname(fromRolldown.resolve(`@rolldown/binding-${platformTag}/package.json`)),
  `rolldown-binding.${platformTag}.node`,
)

export default {
  entry: { main: "src/main.ts", "webp-worker": "src/modules/transcript/adapters/webp-worker.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  fixedExtension: false,
  deps: {
    alwaysBundle: [
      /^effect/,
      /^@ivin\//,
      /^@jsquash\//,
      /^jsonc-parser/,
      /^rolldown/,
      /^@rolldown\/pluginutils/,
      /^@oxc-project\//,
    ],
    neverBundle: [/^@rolldown\/binding-/],
    onlyBundle: false,
  },
  // `webp-codec.ts` reads these from `dist/wasm`, `fs-user-plugins.ts` the binding from `dist/native`, `pnpm.ts` pnpm from `dist/pnpm`.
  copy: [
    { from: rolldownBinding, to: "dist/native", rename: "rolldown-binding.node" },
    { from: pnpmFolder, to: "dist" },
    {
      from: [
        "node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm",
        "node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm",
        "node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm",
      ],
      to: "dist/wasm",
      flatten: true,
    },
  ],
} satisfies PackUserConfig
