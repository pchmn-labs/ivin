import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: "*.test.ts",
  outputDir: "../test-results",
  timeout: 60_000,
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure" },
})
