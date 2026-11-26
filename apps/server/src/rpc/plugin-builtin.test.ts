import { Effect } from "effect"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writeFiles, writePlugin } from "./plugin-test-server.ts"
import { until } from "./test-waits.ts"

vi.setConfig({ testTimeout: 60_000 })

// What the server's build writes: bundles and their index.
const writeBuiltins = () => {
  const folder = tempDir("builtins")
  const manifest = packageJson({
    id: "greeter",
    name: "Greeter",
    ui: "src/ui.tsx",
    server: "src/server.ts",
    views: {
      hello: { title: "Hello", icon: "file", placements: ["sheet"], defaultPlacement: "sheet" },
    },
  })
  writeFiles(folder, {
    "ui.js": "export const activate = () => {}",
    "server.mjs": `export const activate = (ctx) => ctx.commands.register("greeter.hi", () => "from the app")`,
    "index.json": JSON.stringify([{ id: "greeter", manifest, ui: "ui.js", server: "server.mjs" }]),
  })
  return folder
}

test("plugin.listBuiltin lists the prebuilt plugins' UI bundles with their views", async () => {
  const listed = await withPluginServer(
    tempDir("home"),
    (client) => client["plugin.listBuiltin"](),
    {
      builtins: writeBuiltins(),
    },
  )
  expect(listed).toEqual([
    {
      _tag: "compiled",
      id: "greeter",
      name: "Greeter",
      bundle: "ui.js",
      views: [
        {
          name: "hello",
          title: "Hello",
          icon: "file",
          placements: ["sheet"],
          defaultPlacement: "sheet",
          restore: true,
        },
      ],
    },
  ])
})

test("a built-in plugin's server half runs in the plugin host, and a user plugin with its id replaces it", async () => {
  const builtins = writeBuiltins()
  const run = (home: string) =>
    withPluginServer(
      home,
      (client) =>
        until(
          client["plugin.run"]({ command: "greeter.hi", args: null }).pipe(
            Effect.catchTag("CommandNotFound", () => Effect.succeed(null)),
          ),
          (value) => value !== null,
        ),
      { builtins },
    )

  expect(await run(tempDir("home"))).toBe("from the app")

  const home = tempDir("home")
  writePlugin(home, "greeter", {
    "package.json": packageJson({ id: "greeter", server: "src/server.ts" }),
    "src/server.ts": `export const activate = (ctx) => ctx.commands.register("greeter.hi", () => "from the user")`,
  })
  expect(await run(home)).toBe("from the user")
})
