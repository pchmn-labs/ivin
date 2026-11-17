import type { PackUserConfig } from "vite-plus/pack"

export default {
  entry: { main: "src/main.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  fixedExtension: false,
  deps: { alwaysBundle: [/^effect/, /^@ivin\//], onlyBundle: false },
} satisfies PackUserConfig
