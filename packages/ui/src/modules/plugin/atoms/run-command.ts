import { Effect } from "effect"
import type { Json } from "@ivin/plugin-api/ui"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const runCommandAtom = serverRuntime.fn<{
  readonly command: string
  readonly args: Json
}>()(
  Effect.fnUntraced(function* ({ command, args }) {
    const client = yield* ServerClient
    return yield* client["plugin.run"]({ command, args })
  }),
)
