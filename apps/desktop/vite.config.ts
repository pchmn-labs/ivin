import { defineConfig } from "vite-plus"
import type { PackUserConfig } from "vite-plus/pack"

const shared: PackUserConfig = {
  platform: "node",
  target: "node22",
  outDir: "dist",
  deps: { neverBundle: ["electron"] },
}

export default defineConfig({
  pack: [
    {
      ...shared,
      entry: { main: "src/main.ts" },
      format: "esm",
      clean: true,
      fixedExtension: false,
    },
    {
      ...shared,
      entry: { preload: "src/preload.ts" },
      format: "cjs",
      fixedExtension: true,
    },
  ],
})
