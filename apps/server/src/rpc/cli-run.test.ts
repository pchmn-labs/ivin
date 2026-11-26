import { beforeAll, expect, test, vi } from "vitest"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"
import { hostEntry } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writePlugin } from "./plugin-test-server.ts"

// Starts the plugin host and compiles with Rolldown.
vi.setConfig({ testTimeout: 60_000 })

beforeAll(buildCli, 60_000)

test("ivin run runs a server half's command and prints its result as JSON", async () => {
  const ivinHome = tempDir("home")
  writePlugin(ivinHome, "calc", {
    "package.json": packageJson({ id: "calc", server: "src/server.ts" }),
    "src/server.ts": `export const activate = (ctx) => {
  ctx.commands.register("calc.add", ({ a, b }) => ({ sum: a + b }))
}`,
  })

  const { ran, unknown } = await withCliServer(
    async (socketPath) => {
      const env = { IVIN_SOCKET: socketPath }
      await expect
        .poll(
          async () => (await runCli(["run", "calc.add", "--args", '{"a":2,"b":3}'], env)).code,
          {
            timeout: 30_000,
          },
        )
        .toBe(0)
      return {
        ran: await runCli(["run", "calc.add", "--args", '{"a":2,"b":3}'], env),
        unknown: await runCli(["run", "nope"], env),
      }
    },
    { ivinHome, pluginHostEntry: hostEntry },
  )

  expect(JSON.parse(ran.stdout)).toEqual({ sum: 5 })
  expect(unknown.code).toBe(1)
  expect(unknown.stderr).toContain("No plugin registered the command nope")
})
