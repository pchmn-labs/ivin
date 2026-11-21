import type { SubView, Tab } from "@ivin/contracts/tab"
import { Context, type Effect } from "effect"

export interface StoredSubView {
  readonly subView: SubView
  readonly workingFolder: string
  readonly selected: boolean
}

export class TabStore extends Context.Service<
  TabStore,
  {
    readonly find: (sessionId: string) => Effect.Effect<Tab | null>
    readonly listByProject: (projectPath: string) => Effect.Effect<readonly Tab[]>
    readonly selectedOf: (projectPath: string) => Effect.Effect<string | null>
    readonly append: (tab: Tab) => Effect.Effect<void>
    readonly remove: (sessionId: string) => Effect.Effect<void>
    readonly removeByProject: (projectPath: string) => Effect.Effect<void>
    readonly setOrder: (projectPath: string, sessionIds: readonly string[]) => Effect.Effect<void>
    readonly select: (projectPath: string, sessionId: string | null) => Effect.Effect<void>
    readonly subViewsOf: (sessionId: string) => Effect.Effect<readonly StoredSubView[]>
    readonly appendSubView: (
      sessionId: string,
      subView: SubView,
      workingFolder: string,
    ) => Effect.Effect<void>
    readonly removeSubView: (sessionId: string, subView: SubView) => Effect.Effect<void>
    readonly selectSubView: (sessionId: string, subView: SubView | null) => Effect.Effect<void>
    readonly removeSubViewsOutside: (
      sessionId: string,
      workingFolder: string,
    ) => Effect.Effect<void>
  }
>()("ivin/server/TabStore") {}
