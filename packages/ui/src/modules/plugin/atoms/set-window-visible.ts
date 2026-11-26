import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const setWindowVisibleAtom = serverRuntime.fn<boolean>()(
  Effect.fnUntraced(function* (visible) {
    const client = yield* ServerClient
    yield* client["plugin.setWindowVisible"]({ visible })
  }),
)
