import type { ErrorReport } from "@ivin/contracts/log"
import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const writeErrorAtom = serverRuntime.fn<ErrorReport>()(
  Effect.fnUntraced(function* (report) {
    const client = yield* ServerClient
    yield* client["log.writeError"](report)
  }),
)
