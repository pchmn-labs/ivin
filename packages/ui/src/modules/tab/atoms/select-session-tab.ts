import { Effect } from "effect"
import type { TabSubViews } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { withSessionTabSelected } from "../rules/sub-views.ts"
import { subViewsOf } from "./list-sub-views.ts"

export const selectSessionTabAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly workingFolder: string
}>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder }) {
    const client = yield* ServerClient
    const state = subViewsOf(sessionId, workingFolder)
    const before = yield* state.get
    if (before === null) return undefined
    return yield* optimistic<TabSubViews>({
      apply: state.set(withSessionTabSelected(before)),
      rollback: state.set(before),
      reconcile: (answer) => state.set(answer),
    })(client["tab.selectSessionTab"]({ sessionId }))
  }),
)
