import type { Tab } from "@ivin/contracts/tab"
import { Context, type Effect } from "effect"

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
  }
>()("ivin/server/TabStore") {}
