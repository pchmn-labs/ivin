import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { makeFedState, type FedState } from "@ivin/state/fed-state"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { closeTabs } from "../rules/close-tabs.ts"

export const tabsOf = strongFamily(
  (
    projectPath: string,
  ): FedState<ProjectTabs> & { readonly closing: Atom.Writable<ReadonlyArray<string>> } => {
    const fed = makeFedState({
      initial: { projectPath, tabs: [], selectedSessionId: null },
      runtime: serverRuntime,
      load: Effect.gen(function* () {
        const client = yield* ServerClient
        return yield* client["tab.list"]({ projectPath })
      }),
    })
    // Hidden on read, so a server answer that still lists them does not show them again.
    const closing = Atom.make<ReadonlyArray<string>>([]).pipe(Atom.keepAlive)
    const value = Atom.readable((get) => closeTabs(get(fed.value), new Set(get(closing))))
    return { ...fed, value, closing }
  },
)
