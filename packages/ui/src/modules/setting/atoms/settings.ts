import { defaultSettings } from "@ivin/contracts/setting"
import { Effect, Stream } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const userSettingsAtom = serverRuntime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return client["setting.watch"]()
      }),
    ),
  )
  .pipe(Atom.keepAlive)

export const settingsAtom = Atom.readable((get) => {
  const result = get(userSettingsAtom)
  return AsyncResult.isSuccess(result) ? result.value.settings : defaultSettings
})
