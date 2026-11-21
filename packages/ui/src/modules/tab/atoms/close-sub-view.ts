import { Effect } from "effect"
import type { SubView, TabSubViews } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { withSubViewClosed } from "../rules/sub-views.ts"
import { subViewsOf } from "./list-sub-views.ts"

export const closeSubViewAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly workingFolder: string
  readonly subView: SubView
}>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder, subView }) {
    const client = yield* ServerClient
    const state = subViewsOf(sessionId, workingFolder)
    const before = yield* state.get
    if (before === null) return undefined
    return yield* optimistic<TabSubViews>({
      apply: state.set(withSubViewClosed(before, subView)),
      rollback: state.set(before),
      reconcile: (answer) => state.set(answer),
    })(client["tab.closeSubView"]({ sessionId, subView }))
  }),
)
