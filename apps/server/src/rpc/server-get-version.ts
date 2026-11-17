import { Effect } from "effect"
import { ServerInfo } from "../shared/server-info.ts"

export const getVersion = Effect.gen(function* () {
  const { version } = yield* ServerInfo
  return { version }
})
