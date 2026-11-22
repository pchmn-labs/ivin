import { defaultSettings, type UserSettings } from "@ivin/contracts/setting"
import { Effect, Stream } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export interface WatchedSettings extends UserSettings {
  // Grows with each change of the file, across reconnections.
  readonly version: number
}

let version = 0

export const watchedSettingsAtom = serverRuntime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["setting.watch"]().pipe(
          Stream.map((settings): WatchedSettings => ({ ...settings, version: ++version })),
        )
      }),
    ),
  )
  .pipe(Atom.keepAlive)

export const settingsAtom = Atom.readable((get) => {
  const result = get(watchedSettingsAtom)
  return AsyncResult.isSuccess(result) ? result.value.settings : defaultSettings
})

export const settingsProblemAtom = Atom.readable((get) => {
  const result = get(watchedSettingsAtom)
  return AsyncResult.isSuccess(result) ? result.value.problem : null
})
