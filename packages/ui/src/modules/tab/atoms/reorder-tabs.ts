import { Effect } from "effect"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { reorder } from "../rules/reorder.ts"
import { tabsOf } from "./list-tabs.ts"

export const reorderTabsAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionIds: ReadonlyArray<string>
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionIds }) {
    const client = yield* ServerClient
    const state = tabsOf(projectPath)
    const before = yield* state.get
    if (before === null) return undefined
    return yield* optimistic<ProjectTabs>({
      apply: state.set({
        ...before,
        tabs: reorder(
          before.tabs.map((tab) => tab.sessionId),
          sessionIds,
        ).map((id) => before.tabs.find((tab) => tab.sessionId === id)!),
      }),
      rollback: state.set(before),
      reconcile: (answer) => state.set(answer),
    })(client["tab.reorder"]({ projectPath, sessionIds }))
  }),
)
