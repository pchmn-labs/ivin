import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          setupFiles: ["tools/test-setup/hide-real-claude.ts"],
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
