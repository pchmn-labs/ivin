import { defaultSettings, type Settings, type UserSettings } from "@ivin/contracts/setting"
import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect"
import { readSettingsFile } from "../rules/read-settings-file.ts"
import { SettingsFile } from "./settings-file.ts"

export class CurrentSettings extends Context.Service<
  CurrentSettings,
  {
    readonly get: Effect.Effect<Settings>
    // The current value first, then each change.
    readonly changes: Stream.Stream<UserSettings>
  }
>()("ivin/server/CurrentSettings") {}

export const layerCurrentSettings = Layer.effect(CurrentSettings)(
  Effect.gen(function* () {
    const file = yield* SettingsFile
    const ref = yield* SubscriptionRef.make<UserSettings>({
      settings: defaultSettings,
      problem: null,
    })
    yield* file.contents.pipe(
      Stream.runForEach((text) =>
        SubscriptionRef.get(ref).pipe(
          Effect.map((previous) => readSettingsFile(previous, text)),
          Effect.tap(({ problem }) =>
            problem === null
              ? Effect.void
              : Effect.logWarning("settings.json is invalid, keeping the last valid one", problem),
          ),
          Effect.flatMap((next) => SubscriptionRef.set(ref, next)),
        ),
      ),
      Effect.forkScoped,
    )
    return {
      get: SubscriptionRef.get(ref).pipe(Effect.map(({ settings }) => settings)),
      changes: SubscriptionRef.changes(ref),
    }
  }),
)
