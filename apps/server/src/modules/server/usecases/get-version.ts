import { Effect } from "effect"
import { ServerInfo } from "./server-info.ts"

export const getVersion = Effect.gen(function* () {
  const { version } = yield* ServerInfo
  return { version }
})
