import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import browserConfig from "./vitest.browser.config.ts"

const { setupFiles, browser } = browserConfig.test!

// Frame rates of the build the app ships: production React, memoised by the React Compiler.
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  oxc: { jsx: { runtime: "automatic", development: false } },
  test: {
    name: "ui-perf",
    setupFiles,
    browser,
    include: ["src/**/*.perf.test.tsx"],
    // After every other project: tests running beside it slow its frames, and it slows theirs.
    sequence: { groupOrder: 1 },
  },
})
