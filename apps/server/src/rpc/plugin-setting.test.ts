import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf, SettingsFile } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers, layerServices } from "./handlers.ts"
import { packageJson, tempDir, writePlugin } from "./plugin-test-server.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withPlugins = <A, E>(
  home: string,
  settingsText: string | null,
  use: (client: Client, file: SettingsFile["Service"]) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* makeClient()
      return yield* use(client, yield* SettingsFile)
    }).pipe(
      Effect.provide(
        handlers.pipe(
          Layer.provideMerge(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(layerDatabase(":memory:")),
          Layer.provide(Layer.succeed(ImageFolder)({ path: tempDir("images") })),
          Layer.provide(layerScripted([])),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provideMerge(layerSettingsFileOf([settingsText])),
          Layer.provide(layerFsUserPlugins(home)),
        ),
      ),
      Effect.scoped,
    ),
  )

const declared = {
  fold: { type: "number", default: 2, title: "Fold after", description: "Rows before a fold." },
  compact: { type: "boolean", default: false, title: "Compact", description: "Tighter rows." },
  layout: {
    type: "string",
    default: "rail",
    values: ["rail", "strip"],
    title: "Layout",
    description: "How rows sit.",
  },
}

const homeWithPlugin = () => {
  const home = tempDir("home")
  writePlugin(home, "prs", {
    "package.json": packageJson({
      id: "prs",
      name: "Session PRs",
      ui: "src/ui.tsx",
      settings: declared,
    }),
  })
  return home
}

const watchedPluginSettings = (client: Client) =>
  client["setting.watch"]().pipe(
    Stream.runHead,
    Effect.map((head) => (head._tag === "Some" ? head.value.pluginSettings : undefined)),
  )

test("a user plugin's manifest settings are read, with their defaults over the file's values", async () => {
  const settings = await withPlugins(homeWithPlugin(), '{ "prs": { "fold": 5 } }', (client) =>
    watchedPluginSettings(client),
  )

  expect(
    settings?.map(({ pluginId, pluginName, key, title, value, ignored }) => ({
      pluginId,
      pluginName,
      key,
      title,
      value,
      ignored,
    })),
  ).toEqual([
    {
      pluginId: "prs",
      pluginName: "Session PRs",
      key: "fold",
      title: "Fold after",
      value: 5,
      ignored: false,
    },
    {
      pluginId: "prs",
      pluginName: "Session PRs",
      key: "compact",
      title: "Compact",
      value: false,
      ignored: false,
    },
    {
      pluginId: "prs",
      pluginName: "Session PRs",
      key: "layout",
      title: "Layout",
      value: "rail",
      ignored: false,
    },
  ])
})

test("a wrong value in settings.json falls back to the default and is flagged", async () => {
  const settings = await withPlugins(
    homeWithPlugin(),
    '{ "prs": { "fold": "many", "layout": "grid" } }',
    (client) => watchedPluginSettings(client),
  )

  expect(settings?.map(({ key, value, ignored }) => [key, value, ignored])).toEqual([
    ["fold", 2, true],
    ["compact", false, false],
    ["layout", "rail", true],
  ])
})

test("a plugin setting is read and written like the app's own", async () => {
  const result = await withPlugins(
    homeWithPlugin(),
    '{ "tabs": { "stopAgentOnClose": true } }',
    (client, file) =>
      Effect.gen(function* () {
        const before = yield* client["setting.get"]({ path: "prs.fold" })
        yield* client["setting.set"]({ path: "prs.fold", value: 7 })
        yield* client["setting.set"]({ path: "prs.layout", value: "strip" })
        const wrong = yield* client["setting.set"]({ path: "prs.fold", value: "7" }).pipe(
          Effect.flip,
        )
        const outside = yield* client["setting.set"]({ path: "prs.layout", value: "grid" }).pipe(
          Effect.flip,
        )
        const unknown = yield* client["setting.set"]({ path: "prs.nope", value: 1 }).pipe(
          Effect.flip,
        )
        return {
          before,
          after: yield* client["setting.get"]({ path: "prs.fold" }),
          section: yield* client["setting.get"]({ path: "prs" }),
          wrong,
          outside,
          unknown,
          text: yield* file.read,
        }
      }),
  )

  expect(result.before).toBe(2)
  expect(result.after).toBe(7)
  expect(result.section).toEqual({ fold: 7, compact: false, layout: "strip" })
  expect(JSON.parse(result.text ?? "")).toEqual({
    tabs: { stopAgentOnClose: true },
    prs: { fold: 7, layout: "strip" },
  })
  expect(result.wrong).toMatchObject({
    _tag: "SettingValueInvalid",
    path: "prs.fold",
    expected: "number",
  })
  expect(result.outside).toMatchObject({
    _tag: "SettingValueInvalid",
    expected: "oneOf",
    allowed: ["rail", "strip"],
  })
  expect(result.unknown).toMatchObject({ _tag: "SettingPathUnknown", path: "prs.nope" })
  expect(result.unknown._tag === "SettingPathUnknown" && result.unknown.knownPaths).toContain(
    "prs.compact",
  )
})

test("a manifest with a malformed setting is refused and logged, and declares nothing", async () => {
  const home = tempDir("home")
  writePlugin(home, "bad", {
    "package.json": packageJson({
      id: "bad",
      ui: "src/ui.tsx",
      settings: { fold: { type: "date", default: 1, title: "t", description: "d" } },
    }),
  })

  const result = await withPlugins(home, null, (client) =>
    Effect.gen(function* () {
      const plugins = yield* client["plugin.list"]().pipe(Stream.runCollect)
      return {
        plugins: [...plugins],
        log: yield* client["plugin.readLog"]({ id: "bad" }),
        settings: yield* watchedPluginSettings(client),
      }
    }),
  )

  expect(result.plugins).toMatchObject([{ _tag: "failed", id: "bad" }])
  expect(result.log.join("\n")).toContain("ivin.settings.fold.type")
  expect(result.settings).toEqual([])
})

test("a user plugin with a built-in plugin's id replaces its settings", async () => {
  const home = tempDir("home")
  writePlugin(home, "usage", {
    "package.json": packageJson({ id: "usage", ui: "src/ui.tsx", settings: declared }),
  })
  const settings = await withPlugins(home, null, (client) => watchedPluginSettings(client))
  expect(settings?.map(({ pluginId, key }) => `${pluginId}.${key}`)).toEqual([
    "usage.fold",
    "usage.compact",
    "usage.layout",
  ])
})
