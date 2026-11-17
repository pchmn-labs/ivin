import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts", "tools/**/*.test.ts"],
  },
})
