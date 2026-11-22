import { Effect } from "effect"
import type { TabSubViews } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { withFullWidth } from "../rules/sub-views.ts"
import { subViewsOf } from "./list-sub-views.ts"

export const setFullWidthAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly workingFolder: string
  readonly fullWidth: boolean
}>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder, fullWidth }) {
    const client = yield* ServerClient
    const state = subViewsOf(sessionId, workingFolder)
    const before = yield* state.get
    if (before === null) return undefined
    return yield* optimistic<TabSubViews>({
      apply: state.set(withFullWidth(before, fullWidth)),
      rollback: state.set(before),
      reconcile: (answer) => state.set(answer),
    })(client["tab.setFullWidth"]({ sessionId, fullWidth }))
  }),
)
