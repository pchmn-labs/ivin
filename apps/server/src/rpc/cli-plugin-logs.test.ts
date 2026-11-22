import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeAll, expect, test } from "vitest"
import { listPlugins } from "../modules/plugin/usecases/list-plugins.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

const homeWithBrokenPlugin = () => {
  const home = mkdtempSync(join(tmpdir(), "ivin-home-"))
  const folder = join(home, "plugins", "broken")
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, "package.json"), JSON.stringify({ ivin: { id: "broken" } }))
  return home
}

test("ivin plugin logs prints why a plugin failed to load", async () => {
  const ivinHome = homeWithBrokenPlugin()
  const run = await withCliServer(
    async (socketPath, run) => {
      await run(listPlugins)
      return runCli(["plugin", "logs", "broken"], { IVIN_SOCKET: socketPath })
    },
    { ivinHome },
  )

  expect(run.code).toBe(0)
  expect(run.stdout).toContain("ivin.ui in package.json names no file")
}, 10_000)

test("a plugin that never failed has an empty log, and a missing id exits 2", async () => {
  const ivinHome = mkdtempSync(join(tmpdir(), "ivin-home-"))
  const [empty, missing] = await withCliServer(
    (socketPath) =>
      Promise.all([
        runCli(["plugin", "logs", "fine", "--json"], { IVIN_SOCKET: socketPath }),
        runCli(["plugin", "logs"], { IVIN_SOCKET: socketPath }),
      ]),
    { ivinHome },
  )

  expect(JSON.parse(empty.stdout)).toEqual({ ok: true, id: "fine", lines: [] })
  expect(missing.code).toBe(2)
  expect(missing.stderr).toContain("ivin plugin logs needs a plugin id")
}, 10_000)
