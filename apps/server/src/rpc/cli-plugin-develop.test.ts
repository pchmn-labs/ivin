import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { beforeAll, expect, test, vi } from "vitest"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"
import { tempDir } from "./plugin-test-server.ts"

// Rolldown and the type checker run for real.
vi.setConfig({ testTimeout: 60_000 })

beforeAll(buildCli, 60_000)

test("ivin plugin new, check and reload take a plugin from nothing to a loaded one", async () => {
  const ivinHome = tempDir("home")

  const runs = await withCliServer(
    async (socketPath) => {
      const env = { IVIN_SOCKET: socketPath }
      const created = await runCli(["plugin", "new", "demo"], env)
      const checked = await runCli(["plugin", "check", "demo"], env)
      const reloaded = await runCli(["plugin", "reload", "demo"], env)
      const again = await runCli(["plugin", "new", "demo"], env)
      return { created, checked, reloaded, again }
    },
    { ivinHome },
  )

  expect(runs.created.code).toBe(0)
  expect(runs.created.stdout).toContain(
    `Created plugin demo in ${join(ivinHome, "plugins", "demo")}`,
  )
  for (const file of [
    "package.json",
    "tsconfig.json",
    "README.md",
    "src/ui.tsx",
    "src/server.ts",
  ]) {
    expect(existsSync(join(ivinHome, "plugins", "demo", file))).toBe(true)
  }
  expect(runs.checked.code).toBe(0)
  expect(runs.checked.stdout).toContain("Plugin demo has no type error")
  expect(runs.reloaded.code).toBe(0)
  expect(runs.reloaded.stdout).toContain("Reloaded plugin demo: ui active")
  expect(runs.again.code).toBe(1)
  expect(runs.again.stderr).toContain("already holds a plugin with the id demo")
})

test("ivin plugin check prints each type error and exits 1", async () => {
  const ivinHome = tempDir("home")

  const run = await withCliServer(
    async (socketPath) => {
      const env = { IVIN_SOCKET: socketPath }
      await runCli(["plugin", "new", "demo"], env)
      writeFileSync(
        join(ivinHome, "plugins", "demo", "src", "ui.tsx"),
        'import { defineUi } from "@ivin/plugin-api/ui"\nexport const activate = defineUi((ctx) => ctx.slots.add("nowhere", () => null))\n',
      )
      return runCli(["plugin", "check", "demo"], env)
    },
    { ivinHome },
  )

  expect(run.code).toBe(1)
  expect(run.stderr).toMatch(/src\/ui\.tsx\(2,\d+\): error TS2345/)
})

test("ivin plugin check, reload and new refuse what they cannot act on", async () => {
  const run = await withCliServer(
    async (socketPath) => {
      const env = { IVIN_SOCKET: socketPath }
      return {
        check: await runCli(["plugin", "check", "nope"], env),
        reload: await runCli(["plugin", "reload", "nope"], env),
        malformed: await runCli(["plugin", "new", "Not An Id"], env),
        missing: await runCli(["plugin", "reload"], env),
      }
    },
    { ivinHome: tempDir("home") },
  )

  expect(run.check.code).toBe(1)
  expect(run.check.stderr).toContain("No plugin in ~/.ivin/plugins has the id nope")
  expect(run.reload.code).toBe(1)
  expect(run.malformed.code).toBe(1)
  expect(run.malformed.stderr).toContain("lowercase letters")
  expect(run.missing.code).toBe(2)
  expect(run.missing.stderr).toContain("ivin plugin reload needs a plugin id")
})

test("ivin plugin disable and enable turn a plugin off and on, and plugin list shows it disabled", async () => {
  const run = await withCliServer(
    async (socketPath) => {
      const env = { IVIN_SOCKET: socketPath }
      await runCli(["plugin", "new", "demo"], env)
      return {
        disabled: await runCli(["plugin", "disable", "demo", "--json"], env),
        listed: await runCli(["plugin", "list"], env),
        enabled: await runCli(["plugin", "enable", "demo"], env),
        unknown: await runCli(["plugin", "disable", "nope"], env),
      }
    },
    { ivinHome: tempDir("home") },
  )

  expect(JSON.parse(run.disabled.stdout)).toMatchObject({ plugin: { id: "demo", enabled: false } })
  expect(run.listed.stdout).toContain("ui: disabled  server: disabled")
  expect(run.enabled.stdout).toContain("Enabled plugin demo")
  expect(run.unknown.code).toBe(1)
  expect(run.unknown.stderr).toContain("No plugin in ~/.ivin/plugins has the id nope")
})
