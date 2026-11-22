import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { closeTabs, reopenTab } from "../rules/close-tabs.ts"
import { tabsOf } from "./list-tabs.ts"

// An answer to one close still lists the tabs of the closes not answered yet.
const closingTabsOf = Atom.family((_projectPath: string) =>
  Atom.make<ReadonlyArray<string>>([]).pipe(Atom.keepAlive),
)

// Hides the session's tab while `run` closes it on the server, and puts it back if `run` fails.
export const closingTab =
  (projectPath: string, sessionId: string) =>
  <E, R>(run: Effect.Effect<ProjectTabs, E, R>) =>
    Effect.gen(function* () {
      const state = tabsOf(projectPath)
      const closing = closingTabsOf(projectPath)
      const before = yield* state.get
      if (before === null) return yield* run.pipe(Effect.tap(state.set))
      const settle = Atom.update(closing, (ids) => ids.filter((id) => id !== sessionId))
      const show = (bar: ProjectTabs) =>
        Effect.flatMap(Atom.get(closing), (ids) => state.set(closeTabs(bar, new Set(ids))))
      return yield* optimistic<ProjectTabs>({
        apply: Atom.update(closing, (ids) => [...ids, sessionId]).pipe(
          Effect.andThen(show(before)),
        ),
        rollback: settle.pipe(
          Effect.andThen(state.get),
          Effect.flatMap((bar) => show(reopenTab(bar ?? before, before, sessionId))),
        ),
        reconcile: (answer) => settle.pipe(Effect.andThen(show(answer))),
      })(run)
    })

export const closeTabAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId }) {
    const client = yield* ServerClient
    return yield* closingTab(projectPath, sessionId)(client["tab.close"]({ sessionId }))
  }),
  { concurrent: true },
)
