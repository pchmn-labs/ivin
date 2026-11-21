import type { PackUserConfig } from "vite-plus/pack"

export default {
  entry: { main: "src/main.ts", "webp-worker": "src/modules/transcript/adapters/webp-worker.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  fixedExtension: false,
  deps: { alwaysBundle: [/^effect/, /^@ivin\//, /^@jsquash\//, /^jsonc-parser/], onlyBundle: false },
  // `webp-codec.ts` reads these from `dist/wasm`.
  copy: [
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
