import { Effect, Fiber, Stream } from "effect"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import {
  packageJson,
  tempDir,
  withServer,
  writeFiles,
  writePlugin,
  type Client,
} from "./plugin-test-server.ts"
import { forkWatch, until } from "./test-waits.ts"

vi.setConfig({ testTimeout: 60_000 })

const greeter = (text: string) => ({
  "package.json": packageJson({ id: "greeter", ui: "src/ui.tsx", server: "src/server.ts" }),
  "src/ui.tsx": "export const activate = () => 1\n",
  "src/server.ts": `export const activate = (ctx) => ctx.commands.register("greeter.hi", () => ${JSON.stringify(text)})`,
})

const hi = (client: Client, command = "greeter.hi") =>
  client["plugin.run"]({ command, args: null }).pipe(
    Effect.catchTag("CommandNotFound", () => Effect.succeed(null)),
  )

test("a disabled plugin leaves the window and the plugin host, shows disabled, and stays off for the next server until enabled", async () => {
  const home = tempDir("home")
  const database = join(tempDir("db"), "ivin.db")
  writePlugin(home, "greeter", greeter("hello"))

  const first = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* until(hi(client), (value) => value === "hello")
        const window = yield* forkWatch(client["plugin.list"](), (listed) =>
          listed.pipe(Stream.drop(1), Stream.take(1), Stream.runCollect),
        )
        yield* client["plugin.setEnabled"]({ id: "greeter", enabled: false })
        const unknown = yield* client["plugin.setEnabled"]({ id: "nope", enabled: false }).pipe(
          Effect.flip,
        )
        return {
          window: yield* Fiber.join(window),
          afterDisable: yield* hi(client),
          status: yield* client["plugin.status"](),
          unknown,
        }
      }),
    { database },
  )

  expect(first.window).toEqual([{ _tag: "removed", id: "greeter" }])
  expect(first.afterDisable).toBeNull()
  expect(first.status).toEqual([
    { id: "greeter", name: "greeter", ui: "disabled", server: "disabled" },
  ])
  expect(first.unknown).toMatchObject({ _tag: "PluginNotFound", id: "nope" })
  expect(JSON.parse(readFileSync(join(home, "disabled-plugins.json"), "utf8"))).toEqual(["greeter"])

  const restarted = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const listed = yield* client["plugin.list"]().pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.timeoutOption(1500),
        )
        return { listed, run: yield* hi(client), status: yield* client["plugin.status"]() }
      }),
    { database },
  )
  expect(restarted.listed._tag).toBe("None")
  expect(restarted.run).toBeNull()
  expect(restarted.status[0]).toMatchObject({ ui: "disabled", server: "disabled" })

  const enabled = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* client["plugin.setEnabled"]({ id: "greeter", enabled: true })
        return yield* until(hi(client), (value) => value === "hello")
      }),
    { database },
  )
  expect(enabled).toBe("hello")
})

test("a missing or malformed list of disabled plugins disables nothing", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter("hello"))
  writeFileSync(join(home, "disabled-plugins.json"), "{not json")

  const status = await withServer(home, (client) => client["plugin.status"]())

  expect(status).toMatchObject([{ id: "greeter", ui: "active" }])
})

test("safe mode loads only the built-in plugins, and ignores the list of disabled ones", async () => {
  const home = tempDir("home")
  const project = tempDir("project")
  const builtins = tempDir("builtins")
  writeFiles(builtins, {
    "server.mjs": `export const activate = (ctx) => ctx.commands.register("core.hi", () => "built-in")`,
    "index.json": JSON.stringify([
      {
        id: "core",
        manifest: packageJson({ id: "core", server: "src/server.ts" }),
        ui: null,
        server: "server.mjs",
      },
    ]),
  })
  writePlugin(home, "greeter", greeter("user"))
  writeFiles(join(project, ".ivin", "plugins", "mine"), {
    "package.json": packageJson({ id: "mine", server: "src/server.ts" }),
    "src/server.ts": `export const activate = (ctx) => ctx.commands.register("mine.hi", () => "project")`,
  })
  writeFileSync(join(home, "disabled-plugins.json"), JSON.stringify(["core"]))

  const result = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const builtin = yield* until(hi(client, "core.hi"), (value) => value !== null)
        const [projects] = yield* client["plugin.projectPlugins"]().pipe(
          Stream.take(1),
          Stream.runCollect,
        )
        return { builtin, status: yield* client["plugin.status"](), projects }
      }),
    { builtins, trusted: [project], safe: true },
  )

  expect(result).toEqual({ builtin: "built-in", status: [], projects: [] })
})

test("in safe mode a user plugin can still be disabled, so the next launch leaves it off", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter("user"))

  await withPluginServer(
    home,
    (client) => client["plugin.setEnabled"]({ id: "greeter", enabled: false }),
    { safe: true },
  )

  expect(JSON.parse(readFileSync(join(home, "disabled-plugins.json"), "utf8"))).toEqual(["greeter"])
})
