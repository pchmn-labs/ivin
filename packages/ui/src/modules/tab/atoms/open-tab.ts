import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { tabsOf } from "./list-tabs.ts"

export const openTabAtom = serverRuntime.fn<{ readonly sessionId: string }>()(
  Effect.fnUntraced(function* ({ sessionId }) {
    const client = yield* ServerClient
    const tabs = yield* client["tab.open"]({ sessionId })
    yield* tabsOf(tabs.projectPath).set(tabs)
    return tabs
  }),
)
