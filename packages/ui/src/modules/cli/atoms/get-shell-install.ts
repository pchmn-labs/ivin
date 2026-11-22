import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const shellInstallAtom = serverRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ServerClient
    return yield* client["cli.getShellInstall"]()
  }),
)
