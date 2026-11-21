import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { lazyDeps } from "./lazy-deps.ts"

export default defineConfig({
  base: "./",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  optimizeDeps: { include: lazyDeps },
  server: { port: 5173, strictPort: true },
})
