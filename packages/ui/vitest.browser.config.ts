import { playwright } from "@vitest/browser-playwright"
import { configDefaults, defineConfig } from "vitest/config"
import { lazyDeps } from "./lazy-deps.ts"
import { waitForTestFrame } from "./wait-for-test-frame.ts"

export default defineConfig({
  optimizeDeps: { include: lazyDeps },
  test: {
    name: "ui-browser",
    testTimeout: 5000,
    setupFiles: [
      "./src/core/test-frame-setup.ts",
      "./src/core/theme/tokens.css",
      "./src/core/theme/base.css",
    ],
    include: ["src/**/*.test.tsx", "../../plugins/**/*.test.tsx"],
    exclude: [...configDefaults.exclude, "src/**/*.perf.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      commands: { waitForTestFrame },
    },
  },
})
