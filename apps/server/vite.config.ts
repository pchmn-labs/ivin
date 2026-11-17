import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    entry: { main: "src/main.ts" },
    format: "esm",
    platform: "node",
    target: "node22",
    outDir: "dist",
    clean: true,
    fixedExtension: false,
    deps: { alwaysBundle: [/^effect/, /^@ivin\//], onlyBundle: false },
  },
})
