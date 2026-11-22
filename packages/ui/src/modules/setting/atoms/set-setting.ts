import type { SettingPath } from "@ivin/contracts/setting"
import { Cause, Effect } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { shownSetting, type SettingChoice } from "../rules/setting-choice.ts"
import { saveFailureMessage } from "../rules/setting-message.ts"
import { settingValue } from "../rules/setting-value.ts"
import { settingsAtom, watchedSettingsAtom } from "./settings.ts"

const choiceOf = Atom.family((_path: SettingPath) =>
  Atom.make<SettingChoice | null>(null).pipe(Atom.keepAlive),
)

// One per setting, so a change to one does not interrupt the save of another.
export const setSettingOf = Atom.family((path: SettingPath) =>
  serverRuntime.fn<boolean>()((value) =>
    Effect.gen(function* () {
      const client = yield* ServerClient
      const watched = yield* Atom.get(watchedSettingsAtom)
      const fileVersion = AsyncResult.isSuccess(watched) ? watched.value.version : 0
      const choice = { value, fileVersion, failure: null }
      yield* Atom.set(choiceOf(path), choice)
      yield* client["setting.set"]({ path, value }).pipe(
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.void
            : Atom.set(choiceOf(path), {
                ...choice,
                failure: saveFailureMessage(Cause.squash(cause)),
              }),
        ),
      )
    }),
  ),
)

export const shownSettingOf = Atom.family((path: SettingPath) =>
  Atom.readable((get) => {
    const watched = get(watchedSettingsAtom)
    const version = AsyncResult.isSuccess(watched) ? watched.value.version : 0
    return shownSetting(
      { value: settingValue(get(settingsAtom), path), version },
      get(choiceOf(path)),
    )
  }),
)
