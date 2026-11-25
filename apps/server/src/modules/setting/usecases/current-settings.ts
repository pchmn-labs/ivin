import { type PluginSetting, type Settings, type UserSettings } from "@ivin/contracts/setting"
import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect"
import { fileObjectOf, resolvePluginSettings } from "../rules/plugin-settings.ts"
import { readSettingsFile } from "../rules/read-settings-file.ts"
import { PluginSettingDeclarations } from "./plugin-setting-declarations.ts"
import { SettingDefaults } from "./setting-defaults.ts"
import { SettingsFile } from "./settings-file.ts"

export class CurrentSettings extends Context.Service<
  CurrentSettings,
  {
    readonly get: Effect.Effect<Settings>
    readonly pluginSettings: Effect.Effect<ReadonlyArray<PluginSetting>>
    // The current value first, then each change.
    readonly changes: Stream.Stream<UserSettings>
  }
>()("ivin/server/CurrentSettings") {}

interface State {
  readonly user: UserSettings
  readonly file: Record<string, unknown>
}

export const layerCurrentSettings = Layer.effect(CurrentSettings)(
  Effect.gen(function* () {
    const file = yield* SettingsFile
    const defaults = yield* SettingDefaults
    const declarations = yield* PluginSettingDeclarations
    const ref = yield* SubscriptionRef.make<State>({
      user: { settings: defaults, problem: null },
      file: {},
    })
    yield* file.contents.pipe(
      Stream.runForEach((text) =>
        SubscriptionRef.get(ref).pipe(
          Effect.map(({ user, file }) => ({
            user: readSettingsFile(user, text, defaults),
            file: fileObjectOf(text, file),
          })),
          Effect.tap(({ user: { problem } }) =>
            problem === null
              ? Effect.void
              : Effect.logWarning("settings.json is invalid, keeping the last valid one", problem),
          ),
          Effect.flatMap((next) => SubscriptionRef.set(ref, next)),
        ),
      ),
      Effect.forkScoped,
    )
    const withPlugins = (declared: Parameters<typeof resolvePluginSettings>[1]) => (state: State) =>
      ({
        ...state.user,
        pluginSettings: resolvePluginSettings(state.file, declared),
      }) satisfies UserSettings
    return {
      get: SubscriptionRef.get(ref).pipe(Effect.map(({ user }) => user.settings)),
      pluginSettings: Effect.gen(function* () {
        const declared = yield* declarations
        return withPlugins(declared)(yield* SubscriptionRef.get(ref)).pluginSettings
      }),
      changes: Stream.unwrap(
        Effect.map(declarations, (declared) =>
          SubscriptionRef.changes(ref).pipe(Stream.map(withPlugins(declared))),
        ),
      ),
    }
  }),
)
