import { Effect } from "effect"
import { readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { expect, test, vi } from "vitest"
import {
  bundlePath,
  importBundle,
  listPlugins,
  packageJson,
  readLog,
  tempDir,
  withServer,
  writeFiles,
  writePlugin,
} from "./plugin-test-server.ts"

// Each test runs pnpm, then Rolldown, in a child process and a native binding.
vi.setConfig({ testTimeout: 60_000 })

// A package on disk, so no test reaches the npm registry.
const writePackage = (name: string, files: Record<string, string> = {}) => {
  const folder = join(tempDir("package"), name)
  writeFiles(folder, {
    "package.json": JSON.stringify({ name, version: "1.0.0", main: "index.js" }),
    ...files,
  })
  return folder
}

const doubler = () =>
  writePackage("doubler", {
    "package.json": JSON.stringify({
      name: "doubler",
      version: "1.0.0",
      main: "index.js",
      peerDependencies: { react: "*" },
    }),
    "index.js": 'exports.double = (n) => n * 2\nexports.react = require("react")\n',
  })

const counterUi = `import { defineUi } from "@ivin/plugin-api/ui"
import { double, react } from "doubler"

export const doublerReact = react

export const activate = defineUi((ctx) => {
  ctx.commands.register("counter.answer", { title: "Answer", run: () => double(21) })
})
`

const counter = (dependencies: Record<string, string>) => ({
  "package.json": packageJson({ id: "counter", ui: "src/ui.ts" }, { dependencies }),
  "src/ui.ts": counterUi,
})

const lock = (home: string, id: string) =>
  withServer(home, (client) => client["plugin.lock"]({ id }).pipe(Effect.result))

const commandValue = (bundle: Record<string, unknown>) => {
  let run: (() => unknown) | undefined
  ;(bundle["activate"] as (ctx: unknown) => void)({
    commands: { register: (_: string, command: { run: () => unknown }) => (run = command.run) },
  })
  return run?.()
}

const installs = (home: string) =>
  readdirSync(join(home, "cache", "plugins", "deps")).filter((name) => !name.startsWith("."))

test("a plugin's dependency, locked then installed, computes its command's value and gets the host's React", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", counter({ doubler: `file:${doubler()}` }))

  expect((await lock(home, "counter"))._tag).toBe("Success")
  const [plugin] = await listPlugins(home)

  const bundle = await importBundle(bundlePath(home, plugin))
  expect(commandValue(bundle)).toBe(42)
  expect(bundle["doublerReact"]).toBe(React)
})

test("two plugins with the same lockfile share one install, and a second load installs nothing", async () => {
  const home = tempDir("home")
  const dependencies = { doubler: `file:${doubler()}` }
  writePlugin(home, "counter", counter(dependencies))
  await lock(home, "counter")
  writePlugin(home, "twin", {
    ...counter(dependencies),
    "package.json": packageJson({ id: "twin", ui: "src/ui.ts" }, { dependencies }),
  })
  await lock(home, "twin")

  const first = await listPlugins(home)
  expect(first.map((p) => p._tag)).toEqual(["compiled", "compiled"])
  const [install] = installs(home)
  expect(installs(home)).toEqual([install])
  // A reinstall would replace the folder, and the marker with it.
  writeFileSync(join(home, "cache", "plugins", "deps", install!, "marker"), "")

  await listPlugins(home)
  expect(installs(home)).toEqual([install])
  expect(readdirSync(join(home, "cache", "plugins", "deps", install!))).toContain("marker")
})

test("the plugin's own node_modules is ignored, and changing it changes nothing", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", {
    ...counter({ doubler: `file:${doubler()}` }),
    "node_modules/doubler/package.json": JSON.stringify({ name: "doubler", main: "index.js" }),
    "node_modules/doubler/index.js": "exports.double = (n) => n * 100\n",
  })
  await lock(home, "counter")
  const [plugin] = await listPlugins(home)
  expect(commandValue(await importBundle(bundlePath(home, plugin)))).toBe(42)

  writePlugin(home, "counter", { "node_modules/doubler/index.js": "exports.double = () => 0\n" })
  const [again] = await listPlugins(home)
  expect(again).toEqual(plugin)
})

test("a plugin with dependencies and no lockfile fails, naming ivin plugin lock", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", counter({ doubler: `file:${doubler()}` }))
  writePlugin(home, "plain", {
    "package.json": packageJson({ id: "plain", ui: "src/ui.ts" }),
    "src/ui.ts": "export const activate = () => {}\n",
  })

  const plugins = await listPlugins(home)
  expect(plugins.find((p) => p.id === "plain")?._tag).toBe("compiled")
  expect(plugins.find((p) => p.id === "counter")).toMatchObject({
    _tag: "failed",
    reason: expect.stringContaining("ivin plugin lock counter"),
  })
  expect(await readLog(home, "counter")).toEqual([expect.stringContaining("no pnpm-lock.yaml")])
})

test("a lockfile that no longer matches package.json fails the plugin", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", counter({ doubler: `file:${doubler()}` }))
  await lock(home, "counter")
  writePlugin(home, "counter", {
    "package.json": packageJson(
      { id: "counter", ui: "src/ui.ts" },
      { dependencies: { doubler: `file:${doubler()}`, extra: `file:${writePackage("extra")}` } },
    ),
  })

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({
    _tag: "failed",
    reason: expect.stringContaining("pnpm-lock.yaml does not match"),
  })
})

test("an install that fails fails the plugin, with pnpm's reason", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", {
    ...counter({ doubler: `file:${doubler()}` }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters: [\n",
  })

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({
    _tag: "failed",
    reason: expect.stringContaining("Could not install its dependencies"),
  })
  expect(installs(home)).toEqual([])
})

test("a dependency that needs native code fails the plugin, naming it", async () => {
  const home = tempDir("home")
  const native = writePackage("native-thing", { "binding.gyp": "{}", "index.js": "" })
  writePlugin(
    home,
    "counter",
    counter({ doubler: `file:${doubler()}`, "native-thing": `file:${native}` }),
  )
  await lock(home, "counter")

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({
    _tag: "failed",
    reason: expect.stringContaining("native-thing needs native code"),
  })
  expect(installs(home)).toEqual([])
})

test("an import missing from the plugin's dependencies fails the compile", async () => {
  const home = tempDir("home")
  writePlugin(home, "counter", {
    ...counter({ doubler: `file:${doubler()}` }),
    "src/ui.ts": `import pad from "left-pad"\n${counterUi}\nexport const p = pad\n`,
  })
  await lock(home, "counter")

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({
    _tag: "failed",
    reason: expect.stringContaining("left-pad, which is not in its dependencies"),
  })
})

test("ivin plugin lock on an unknown plugin says so", async () => {
  const home = tempDir("home")
  const result = await lock(home, "nope")
  expect(result._tag === "Failure" && result.failure._tag).toBe("PluginNotFound")
})
