import type { PackUserConfig } from "vite-plus/pack"

const shared = {
  platform: "node",
  target: "node22",
  outDir: "dist",
  deps: { neverBundle: ["electron"] },
} satisfies PackUserConfig

// The preload of a sandboxed renderer must be CommonJS.
const config: PackUserConfig[] = [
  { ...shared, entry: { main: "src/main.ts" }, format: "esm", clean: true, fixedExtension: false },
  { ...shared, entry: { preload: "src/preload.ts" }, format: "cjs", fixedExtension: true },
]

export default config
