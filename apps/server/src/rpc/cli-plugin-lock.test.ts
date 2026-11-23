import { Stream } from "effect"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { beforeAll, expect, test, vi } from "vitest"
import { listPlugins } from "../modules/plugin/usecases/list-plugins.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"
import { packageJson, tempDir, writeFiles, writePlugin } from "./plugin-test-server.ts"

// pnpm and Rolldown run for real.
vi.setConfig({ testTimeout: 60_000 })

beforeAll(buildCli, 60_000)

test("ivin plugin lock writes a lockfile for a new dependency, and the plugin then loads with it", async () => {
  const ivinHome = tempDir("home")
  const greeting = join(tempDir("package"), "greeting")
  writeFiles(greeting, {
    "package.json": JSON.stringify({ name: "greeting", version: "1.0.0", main: "index.js" }),
    "index.js": 'exports.greet = () => "hi"\n',
  })
  writePlugin(ivinHome, "greeter", {
    "package.json": packageJson(
      { id: "greeter", ui: "src/ui.ts" },
      { dependencies: { greeting: `file:${greeting}` } },
    ),
    "src/ui.ts": 'import { greet } from "greeting"\nexport const activate = () => greet()\n',
  })

  const { lock, plugins } = await withCliServer(
    async (socketPath, run) => {
      const lock = await runCli(["plugin", "lock", "greeter"], { IVIN_SOCKET: socketPath })
      return { lock, plugins: [...(await run(Stream.runCollect(listPlugins)))] }
    },
    { ivinHome },
  )

  expect(lock.code).toBe(0)
  expect(lock.stdout).toContain("Wrote pnpm-lock.yaml for plugin greeter")
  expect(existsSync(join(ivinHome, "plugins", "greeter", "pnpm-lock.yaml"))).toBe(true)
  expect(plugins).toEqual([expect.objectContaining({ _tag: "compiled", id: "greeter" })])
})

test("ivin plugin lock on an unknown plugin exits 1 and names it", async () => {
  const run = await withCliServer(
    (socketPath) => runCli(["plugin", "lock", "nope"], { IVIN_SOCKET: socketPath }),
    { ivinHome: tempDir("home") },
  )

  expect(run.code).toBe(1)
  expect(run.stderr).toContain("No plugin in ~/.ivin/plugins has the id nope")
})
