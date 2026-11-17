import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: [
            "apps/*/src/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            "tools/**/*.test.ts",
            "plugins/**/*.test.ts",
          ],
        },
      },
      "packages/ui/vitest.browser.config.ts",
    ],
  },
})
