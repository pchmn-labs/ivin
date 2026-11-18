import { Effect } from "effect"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { reorderTabs } from "../rules/reorder-tabs.ts"
import { tabsOf } from "./list-tabs.ts"

export const reorderTabsAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionIds: ReadonlyArray<string>
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionIds }) {
    const client = yield* ServerClient
    const state = tabsOf(projectPath)
    const before = yield* state.get
    return yield* optimistic<ProjectTabs>({
      apply: state.set({ ...before, tabs: reorderTabs(before.tabs, sessionIds) }),
      rollback: state.set(before),
      reconcile: (answer) => state.set(answer),
    })(client["tab.reorder"]({ projectPath, sessionIds }))
  }),
)
