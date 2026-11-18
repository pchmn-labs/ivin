import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "ui-browser",
    testTimeout: 5000,
    setupFiles: ["./src/core/theme/tokens.css", "./src/core/theme/base.css"],
    include: ["src/**/*.test.tsx", "../../plugins/**/*.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
})
