import { layerScripted } from "@ivin/harness"
import { HOST_MODULES_GLOBAL, type UserPlugin } from "@ivin/contracts/plugin"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers, layerServices } from "./handlers.ts"

// Rolldown starts its native binding on the first compile.
vi.setConfig({ testTimeout: 20_000 })

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), `ivin-${prefix}-`))

const withServer = <A, E>(home: string, use: (client: Client) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(layerDatabase(":memory:")),
          Layer.provide(Layer.succeed(ImageFolder)({ path: tempDir("images") })),
          Layer.provide(layerScripted([])),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerFsUserPlugins(home)),
        ),
      ),
      Effect.scoped,
    ),
  )

const listPlugins = (home: string) => withServer(home, (client) => client["plugin.list"]())
const readLog = (home: string, id: string) =>
  withServer(home, (client) => client["plugin.readLog"]({ id }))

const writePlugin = (home: string, folder: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) {
    const file = join(home, "plugins", folder, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

const packageJson = (ivin: Record<string, unknown>) => JSON.stringify({ name: "p", ivin })

const greeter = {
  "package.json": packageJson({ id: "greeter", name: "Greeter", ui: "src/ui.tsx" }),
  "src/answer.ts": "export const answer = (n: number) => n * 2\n",
  "src/ui.tsx": `import { useState } from "react"
import { defineUi } from "@ivin/plugin-api/ui"
import { answer } from "./answer.ts"

export function Counter() {
  const [count] = useState(20)
  return <span>count {answer(count)}</span>
}

export const activate = defineUi((ctx) => {
  ctx.commands.register("greeter.answer", { title: "Answer", run: () => answer(21) })
})
`,
}

const bundlePath = (home: string, plugin: UserPlugin | undefined) => {
  if (plugin?._tag !== "compiled") throw new Error(`not compiled: ${JSON.stringify(plugin)}`)
  return join(home, "cache", "plugins", plugin.bundle)
}

// The window's role: give the bundle the host's modules, then import it.
const importBundle = async (path: string) => {
  Object.assign(globalThis, {
    [HOST_MODULES_GLOBAL]: {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "@ivin/plugin-api/ui": { defineUi: (activate: unknown) => activate },
    },
  })
  return (await import(pathToFileURL(path).href)) as Record<string, unknown>
}

test("a plugin's UI half compiles into a bundle whose command returns its value and whose component uses the host's React", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter)

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({ _tag: "compiled", id: "greeter", name: "Greeter" })

  const bundle = await importBundle(bundlePath(home, plugin))
  const commands = new Map<string, () => unknown>()
  ;(bundle["activate"] as (ctx: unknown) => void)({
    commands: { register: (id: string, { run }: { run: () => unknown }) => commands.set(id, run) },
  })
  expect(commands.get("greeter.answer")?.()).toBe(42)
  // A second React would throw on useState here.
  expect(renderToString(React.createElement(bundle["Counter"] as React.FC))).toBe(
    "<span>count <!-- -->40</span>",
  )
})

test("an unchanged plugin is not compiled again, and a changed one is", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter)
  const first = bundlePath(home, (await listPlugins(home))[0])
  writeFileSync(first, "// kept from the first load\n")

  expect(bundlePath(home, (await listPlugins(home))[0])).toBe(first)
  expect(readFileSync(first, "utf8")).toBe("// kept from the first load\n")

  writePlugin(home, "greeter", { "src/answer.ts": "export const answer = (n: number) => n * 3\n" })
  expect(bundlePath(home, (await listPlugins(home))[0])).not.toBe(first)
})

test.each([
  ["has no package.json", "broken", { "src/ui.tsx": "" }, "broken", "no package.json"],
  [
    "has an invalid manifest",
    "broken",
    { "package.json": packageJson({ id: "Broken!", ui: "src/ui.tsx" }) },
    "broken",
    "ivin.id",
  ],
  [
    "does not compile",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx": "export const activate = (",
    },
    "broken",
    "Could not compile src/ui.tsx",
  ],
  [
    "imports a package ivin does not provide",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx":
        'import { renderToString } from "react-dom/server"\nexport const activate = renderToString\n',
    },
    "broken",
    "react-dom/server, which ivin does not provide",
  ],
  [
    "imports an npm package",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx": 'import pad from "left-pad"\nexport const activate = pad\n',
    },
    "broken",
    "It imports left-pad",
  ],
  [
    "names an entry outside its folder",
    "broken",
    { "package.json": packageJson({ id: "broken", ui: "../greeter/src/ui.tsx" }) },
    "broken",
    "leads out of the plugin's folder",
  ],
  [
    "reuses another plugin's id",
    "other",
    { ...greeter, "package.json": packageJson({ id: "greeter", ui: "src/ui.tsx" }) },
    "greeter",
    "The folder greeter already holds",
  ],
])(
  "a plugin that %s is failed with its reason in its log, and the others still load",
  async (_, folder, files, id, reason) => {
    const home = tempDir("home")
    writePlugin(home, "greeter", greeter)
    writePlugin(home, folder, files)

    const plugins = await listPlugins(home)
    expect(plugins.find((p) => p._tag === "compiled")?.id).toBe("greeter")
    const failed = plugins.find((p) => p._tag === "failed")
    expect(failed).toMatchObject({ id, reason: expect.stringContaining(reason) })
    expect(await readLog(home, id)).toEqual([expect.stringContaining(reason)])
  },
)

test("a failure the window reports is added to the plugin's log, newest last", async () => {
  const home = tempDir("home")
  const lines = await withServer(home, (client) =>
    Effect.gen(function* () {
      yield* client["plugin.reportFailure"]({ id: "greeter", reason: "activate threw: first" })
      yield* client["plugin.reportFailure"]({ id: "greeter", reason: "activate threw: second" })
      return yield* client["plugin.readLog"]({ id: "greeter" })
    }),
  )
  expect(lines).toEqual([
    expect.stringMatching(/^\d{4}-\d\d-\d\dT.* activate threw: first$/),
    expect.stringMatching(/activate threw: second$/),
  ])
})

test("with no plugins folder, no plugin loads and a log reads empty", async () => {
  const home = tempDir("home")
  expect(await listPlugins(home)).toEqual([])
  expect(await readLog(home, "../../etc/passwd")).toEqual([])
})
