import { Effect, Stream } from "effect"
import { initialPlugins, loadUiHalf } from "./list-plugins.ts"
import { PluginReloads } from "./plugin-reloads.ts"
import { UserPlugins, type UserPluginsService } from "./user-plugins.ts"

// A reload that fails is logged and sends nothing: the version in the window keeps running.
const reloaded = (plugins: UserPluginsService, folderName: string) =>
  Effect.gen(function* () {
    const folder = (yield* plugins.folders).find((candidate) => candidate.name === folderName)
    if (folder === undefined) return null
    const plugin = yield* loadUiHalf(plugins, folder)
    return plugin?._tag === "compiled" ? plugin : null
  })

// Every plugin once, then each plugin again whenever it reloads, until the subscriber leaves.
export const watchPlugins = Stream.unwrap(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return Stream.empty
    const reloads = yield* PluginReloads
    // Subscribed before the first listing, so a change while the plugins compile is not missed.
    const requests = yield* reloads.subscribe
    return initialPlugins(plugins).pipe(
      Stream.concat(requests.pipe(Stream.mapEffect(({ folder }) => reloaded(plugins, folder)))),
      // A plugin with only a server half has nothing for the window.
      Stream.filter((plugin) => plugin !== null),
    )
  }),
)
