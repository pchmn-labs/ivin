import { Effect, Stream } from "effect"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writeFiles, type Client } from "./plugin-test-server.ts"
import { until } from "./test-waits.ts"

vi.setConfig({ testTimeout: 60_000 })

const mine = (text: string) => ({
  "package.json": packageJson({ id: "mine", server: "src/server.ts" }),
  "src/server.ts": `export const activate = (ctx) => ctx.commands.register("mine.hi", () => ${JSON.stringify(text)})`,
})

const hi = (client: Client) =>
  client["plugin.run"]({ command: "mine.hi", args: null }).pipe(
    Effect.catchTag("CommandNotFound", () => Effect.succeed(null)),
  )

const pending = (client: Client) =>
  client["plugin.projectPlugins"]().pipe(
    Stream.take(1),
    Stream.runCollect,
    Effect.map(([projects]) => projects?.[0]?.plugins[0]),
  )

test("a project plugin's server half runs only once trusted, keeps its trusted version through an edit, and follows it under full trust", async () => {
  const home = tempDir("home")
  const project = tempDir("project")
  const database = join(tempDir("db"), "ivin.db")
  const folder = join(project, ".ivin", "plugins", "mine")
  writeFiles(folder, mine("v1"))
  const options = { database, trusted: [project] }

  const first = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const offered = yield* pending(client)
        const beforeTrust = yield* hi(client)
        yield* client["plugin.trust"]({ project, id: "mine", hash: offered!.hash })
        const trusted = yield* until(hi(client), (value) => value !== null)
        writeFiles(folder, mine("v2"))
        yield* client["plugin.reload"]({ id: "mine" })
        return { beforeTrust, trusted, afterEdit: yield* hi(client) }
      }),
    options,
  )
  expect(first).toEqual({ beforeTrust: null, trusted: "v1", afterEdit: "v1" })

  const second = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const restarted = yield* until(hi(client), (value) => value !== null)
        const changed = yield* pending(client)
        yield* client["plugin.setFullTrust"]({ project, enabled: true })
        return { restarted, state: changed?.state, followed: yield* hi(client) }
      }),
    options,
  )
  expect(second).toEqual({ restarted: "v1", state: "changed", followed: "v2" })
})
