import { Effect, Layer } from "effect"
import { listPluginSettings } from "../modules/plugin/usecases/list-plugin-settings.ts"
import { UserPlugins } from "../modules/plugin/usecases/user-plugins.ts"
import { PluginSettingDeclarations } from "../modules/setting/usecases/plugin-setting-declarations.ts"

export const layerPluginSettingDeclarations = Layer.effect(PluginSettingDeclarations)(
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    return listPluginSettings.pipe(Effect.provideService(UserPlugins, plugins))
  }),
)
